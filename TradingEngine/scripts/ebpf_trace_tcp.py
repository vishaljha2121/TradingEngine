#!/usr/bin/env python3
# This is a stubbed BCC script meant to be run on Linux (Ubuntu 22.04+)
# Setup: sudo apt install bpfcc-tools linux-headers-$(uname -r)
from bcc import BPF
from time import sleep

# Define the eBPF C program
bpf_text = """
#include <uapi/linux/ptrace.h>
#include <net/sock.h>
#include <bcc/proto.h>

BPF_HISTOGRAM(latency);

// Hook into tcp_v4_rcv (IPv4 TCP receive path in Kernel)
int trace_tcp_v4_rcv(struct pt_regs *ctx, struct sk_buff *skb) {
    u64 ts = bpf_ktime_get_ns();
    // In a real implementation, we would map the packet socket to a PID
    // and store the timestamp to compute the delta when userspace reads it
    // For now, we are arbitrarily sampling kernel socket receive rates.
    return 0;
}

// Hook into the tcp_recvmsg (when application reads from socket)
int trace_tcp_recvmsg(struct pt_regs *ctx) {
    u64 ts = bpf_ktime_get_ns();
    // In a real implementation we compute (current_ts - kernel_rx_ts)
    // and store it in the histogram
    u64 delta = 5000; // Simulated 5 microseconds context switch
    latency.increment(bpf_log2l(delta));
    return 0;
}
"""

print("Loading eBPF Tracepoints...")
try:
    # Initialize BPF
    b = BPF(text=bpf_text)
    b.attach_kprobe(event="tcp_v4_rcv", fn_name="trace_tcp_v4_rcv")
    b.attach_kprobe(event="tcp_recvmsg", fn_name="trace_tcp_recvmsg")

    print("Tracing tcp_recvmsg... Hit Ctrl-C to end.")
    while True:
        sleep(1)
except Exception as e:
    print("Error loading eBPF. Ensure you are running on a Linux kernel with CAP_SYS_ADMIN privileges.")
    print(f"Details: {e}")
finally:
    # Print the histogram (mocked)
    print("\nSimulated Kernel-to-Userspace TCP Latency Histogram (microseconds):")
    print("     µsec               : count     distribution")
    print("        0 -> 1          : 0        |                                        |")
    print("        2 -> 3          : 0        |                                        |")
    print("        4 -> 7          : 4205     |****************************************|")
    print("        8 -> 15         : 185      |*                                       |")
    print("       16 -> 31         : 20       |                                        |")
    print("       32 -> 63         : 0        |                                        |")
