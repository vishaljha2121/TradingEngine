using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using TradingEngineServer.Core.Models;
using TradingEngineServer.Core.Services;

namespace TradingEngineServer.Tests;

public class TradingApiIntegrationTests : IClassFixture<WebApplicationFactory<Program>>, IDisposable
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;
    private readonly EventLogger _eventLogger;

    public TradingApiIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _client = factory.CreateClient();

        // Resolve EventLogger to configure deterministic test state.
        _eventLogger = factory.Services.GetRequiredService<EventLogger>();

        // Ensure we start from a clean state.
        _eventLogger.Clear();
        var orderBook = factory.Services.GetRequiredService<IOrderBook>();
        orderBook.Reset();
    }

    public void Dispose()
    {
        _eventLogger.Clear();
    }

    [Fact]
    public async Task PostOrder_Should_Return_Accepted()
    {
        // Arrange
        var request = new
        {
            userId = "IntegrationUser",
            symbol = "BTCUSD",
            isBuy = true,
            price = 50000m,
            size = 1
        };

        // Act
        var response = await _client.PostAsJsonAsync("/api/orders", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Accepted);
        
        // Let background service consume from ring buffer
        await Task.Delay(100); 

        // Verify it was logged
        _eventLogger.GetEventCount().Should().Be(1);
    }

    [Fact]
    public async Task ReplayApi_Should_Rebuild_State_From_Log()
    {
        // Arrange
        var buyReq = new { userId = "Alice", symbol = "BTCUSD", isBuy = true, price = 68000m, size = 2 };
        var sellReq = new { userId = "Bob", symbol = "BTCUSD", isBuy = false, price = 68000m, size = 1 };

        // Act
        await _client.PostAsJsonAsync("/api/orders", buyReq);
        await Task.Delay(100); // Allow consumption
        
        await _client.PostAsJsonAsync("/api/orders", sellReq);
        await Task.Delay(100); // Allow consumption + trade generation

        // We should have 3 events: 2 NewOrders + 1 TradeExecution
        var eventsResponse = await _client.GetFromJsonAsync<JsonElement>("/api/events");
        eventsResponse.GetArrayLength().Should().Be(3);

        // Run Replay via API
        var replayResponse = await _client.PostAsync("/api/replay", null);
        replayResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var result = await replayResponse.Content.ReadFromJsonAsync<ReplayResult>();
        
        // Assert
        result.Should().NotBeNull();
        result!.EventsReplayed.Should().Be(3);
        result.NewOrdersReplayed.Should().Be(2);
        result.TradesGenerated.Should().Be(1);
        
        // Final snapshot should have 1 remaining buy of size 1 (2 - 1 = 1)
        result.FinalSnapshot.Should().NotBeNull();
        result.FinalSnapshot!.Bids.Should().HaveCount(1);
        result.FinalSnapshot.Bids[0].Size.Should().Be(1);
    }

    [Fact]
    public async Task DeleteEventsApi_Should_Clear_Log()
    {
        // Arrange
        var req = new { userId = "Test", symbol = "BTCUSD", isBuy = true, price = 100m, size = 1 };
        await _client.PostAsJsonAsync("/api/orders", req);
        await Task.Delay(100);
        
        _eventLogger.GetEventCount().Should().BeGreaterThan(0);

        // Act
        var delResponse = await _client.DeleteAsync("/api/events");

        // Assert
        delResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        
        var countResponse = await _client.GetFromJsonAsync<JsonElement>("/api/events/count");
        countResponse.GetProperty("count").GetInt32().Should().Be(0);
    }

    [Fact]
    public async Task GameRoom_And_AdminApi_Should_Work_E2E()
    {
        // 1. Admin GET Users
        _client.DefaultRequestHeaders.Add("Admin-Password", "supersecret123");
        var usersRes = await _client.GetFromJsonAsync<JsonElement>("/api/admin/users");
        usersRes.ValueKind.Should().Be(JsonValueKind.Object);

        // 2. Login User
        var loginReq = new { userId = "Player1" };
        var loginRes = await _client.PostAsJsonAsync("/api/users/login", loginReq);
        loginRes.StatusCode.Should().Be(HttpStatusCode.OK);

        // 3. Create Game Room
        var createRoomReq = new { userId = "Player1" };
        var createRes = await _client.PostAsJsonAsync("/api/game/rooms", createRoomReq);
        createRes.StatusCode.Should().Be(HttpStatusCode.OK);
        
        var roomDoc = await createRes.Content.ReadFromJsonAsync<JsonElement>();
        var roomId = roomDoc.GetProperty("roomId").GetString()!;
        roomId.Should().NotBeNullOrEmpty();

        // 4. Join Game Room
        var joinReq = new { userId = "Player2" };
        var joinRes = await _client.PostAsJsonAsync($"/api/game/rooms/{roomId}/join", joinReq);
        joinRes.StatusCode.Should().Be(HttpStatusCode.OK);

        // 5. Start Game
        var startRes = await _client.PostAsync($"/api/game/rooms/{roomId}/start", null);
        startRes.StatusCode.Should().Be(HttpStatusCode.OK);

        // 6. Rig Game Round (Simulates the game and broadcasts state)
        var rigReq = new { outcome = "LEFT" }; // Assuming Frog Jump
        var rigRes = await _client.PostAsJsonAsync($"/api/game/rooms/{roomId}/rig", rigReq);
        rigRes.StatusCode.Should().Be(HttpStatusCode.OK);

        // 7. Delete User (Admin)
        var delRes = await _client.DeleteAsync("/api/admin/users/Player1");
        delRes.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
