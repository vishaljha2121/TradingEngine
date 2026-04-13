import os
import json
import subprocess
import tempfile
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sys

# Import FlatBuffers and the generated Python schema
import flatbuffers
sys.path.append(os.path.join(os.path.dirname(__file__), '../generated'))
import ExecutionCoach.Sim.SimulationRequest as SimulationRequest
import ExecutionCoach.Sim.Quote as QuoteFB
import ExecutionCoach.Sim.ExecutionMode as ExecutionMode
import ExecutionCoach.Sim.LatencyRegime as LatencyRegime

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class QuoteModel(BaseModel):
    bid: float
    ask: float

class SimulateRequestPayload(BaseModel):
    side: str
    sizeUsd: float
    latency: str
    currentQuote: QuoteModel
    inventoryUsd: float

CPP_BIN_PATH = os.path.join(os.path.dirname(__file__), '../../TradingEngine/cpp_backtester/build/backtester')

@app.post("/api/simulate")
def simulate(payload: SimulateRequestPayload):
    # We will invoke the C++ executable 3 times, once for each Mode, using FlatBuffers
    results = []
    
    modes = [
        ("Execute Now", ExecutionMode.ExecutionMode().ExecuteNow),
        ("Slice", ExecutionMode.ExecutionMode().Slice),
        ("Defensive", ExecutionMode.ExecutionMode().Defensive)
    ]
    
    latency_enum = LatencyRegime.LatencyRegime().Nominal
    if payload.latency == "Medium":
        latency_enum = LatencyRegime.LatencyRegime().Medium
    elif payload.latency == "Stressed":
        latency_enum = LatencyRegime.LatencyRegime().Stressed

    is_buy = payload.side == "BUY"

    for mode_name, mode_enum in modes:
        # Build FlatBuffer
        builder = flatbuffers.Builder(1024)
        
        QuoteFB.QuoteStart(builder)
        QuoteFB.QuoteAddBid(builder, payload.currentQuote.bid)
        QuoteFB.QuoteAddAsk(builder, payload.currentQuote.ask)
        quote_offset = QuoteFB.QuoteEnd(builder)
        
        SimulationRequest.SimulationRequestStart(builder)
        SimulationRequest.SimulationRequestAddSide(builder, is_buy)
        SimulationRequest.SimulationRequestAddSizeUsd(builder, payload.sizeUsd)
        SimulationRequest.SimulationRequestAddLatency(builder, latency_enum)
        SimulationRequest.SimulationRequestAddMode(builder, mode_enum)
        SimulationRequest.SimulationRequestAddCurrentQuote(builder, quote_offset)
        SimulationRequest.SimulationRequestAddInventoryUsd(builder, payload.inventoryUsd)
        
        req = SimulationRequest.SimulationRequestEnd(builder)
        builder.Finish(req)
        
        buf = builder.Output()
        
        # Write binary to disk for C++ to pickup
        fd, temp_path = tempfile.mkstemp(suffix=".bin")
        with os.fdopen(fd, 'wb') as f:
            f.write(buf)
        
        # Execute C++ Backtester
        process = subprocess.run([CPP_BIN_PATH, temp_path], capture_output=True, text=True)
        
        os.remove(temp_path)
        
        try:
            out = json.loads(process.stdout)
            # Decorate with the human reason
            reason = "Protects against adverse selection."
            if mode_name == "Execute Now":
                reason = "Aggressive execution acceptable under nominal conditions." if latency_enum == 0 else "Immediate execution under stressed latency risks massive slippage."
            elif mode_name == "Slice":
                reason = "Slicing recommended because trade size is large relative to generic local depth." if payload.sizeUsd > 20000 else "Standard smart-routing enabled."
                
            results.append({
                "mode": mode_name,
                "expectedCost": out.get("simulatedCost", 0),
                "riskScore": out.get("simulatedRisk", 0),
                "reason": reason
            })
        except Exception as e:
            print("C++ Exception:", e, "STDOUT:", process.stdout, "STDERR:", process.stderr)

    # Determine recommended
    if payload.inventoryUsd + payload.sizeUsd > 100000:
        recommended = next(r for r in results if r["mode"] == "Defensive")
        recommended["reason"] = "Risk Guard: Inventory cap threshold breached. Defensive execution mandatory."
    else:
        best = min(results, key=lambda x: x["expectedCost"] + x["riskScore"])
        recommended = best

    return {
        "evaluations": results,
        "recommended": recommended
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
