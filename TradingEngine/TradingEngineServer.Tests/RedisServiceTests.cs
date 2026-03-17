using FluentAssertions;
using Moq;
using StackExchange.Redis;
using TradingEngineServer.Core.Services;

namespace TradingEngineServer.Tests;

public class RedisServiceTests
{
    private readonly Mock<IConnectionMultiplexer> _mockMultiplexer;
    private readonly Mock<IDatabase> _mockDb;
    private readonly RedisService _redisService;

    public RedisServiceTests()
    {
        _mockMultiplexer = new Mock<IConnectionMultiplexer>();
        _mockDb = new Mock<IDatabase>();

        _mockMultiplexer.Setup(x => x.GetDatabase(It.IsAny<int>(), It.IsAny<object>()))
                        .Returns(_mockDb.Object);

        _redisService = new RedisService(_mockMultiplexer.Object);
    }

    [Fact]
    public async Task InitializeUserAsync_Should_Set_Balances_If_User_Not_Exists()
    {
        // Arrange
        _mockDb.Setup(db => db.KeyExistsAsync("user:Alice:balances", CommandFlags.None))
               .ReturnsAsync(false);

        // Act
        await _redisService.InitializeUserAsync("Alice");

        // Assert
        _mockDb.Verify(db => db.HashSetAsync("user:Alice:balances", 
            It.Is<HashEntry[]>(arr => arr.Length == 2 && 
                                      arr[0].Name == "USD" && arr[0].Value == 100000.0 &&
                                      arr[1].Name == "BTC" && arr[1].Value == 5.0), 
            CommandFlags.None), Times.Once);
    }

    [Fact]
    public async Task InitializeUserAsync_Should_Not_Set_Balances_If_Exists()
    {
        // Arrange
        _mockDb.Setup(db => db.KeyExistsAsync("user:Alice:balances", CommandFlags.None))
               .ReturnsAsync(true);

        // Act
        await _redisService.InitializeUserAsync("Alice");

        // Assert
        _mockDb.Verify(db => db.HashSetAsync(It.IsAny<RedisKey>(), It.IsAny<HashEntry[]>(), CommandFlags.None), Times.Never);
    }

    [Fact]
    public async Task GetUserBalancesAsync_Should_Return_Dictionary()
    {
        // Arrange
        var hashEntries = new HashEntry[]
        {
            new HashEntry("USD", 50000.0),
            new HashEntry("BTC", 2.5)
        };
        _mockDb.Setup(db => db.HashGetAllAsync("user:Alice:balances", CommandFlags.None))
               .ReturnsAsync(hashEntries);

        // Act
        var balances = await _redisService.GetUserBalancesAsync("Alice");

        // Assert
        balances.Should().ContainKey("USD").WhoseValue.Should().Be(50000.0);
        balances.Should().ContainKey("BTC").WhoseValue.Should().Be(2.5);
    }

    [Fact]
    public async Task DeleteUserAsync_Should_Call_KeyDelete()
    {
        // Act
        await _redisService.DeleteUserAsync("Alice");

        // Assert
        _mockDb.Verify(db => db.KeyDeleteAsync("user:Alice:balances", CommandFlags.None), Times.Once);
    }

    [Fact]
    public async Task AdjustBalanceAsync_Should_Increment_USD()
    {
        // Act
        await _redisService.AdjustBalanceAsync("Alice", 100.5);

        // Assert
        _mockDb.Verify(db => db.HashIncrementAsync("user:Alice:balances", "USD", 100.5, CommandFlags.None), Times.Once);
    }

    [Fact]
    public async Task SettleTradeAsync_Should_Evaluate_Lua_Script()
    {
        // Arrange
        _mockDb.Setup(db => db.ScriptEvaluateAsync(It.IsAny<string>(), It.IsAny<RedisKey[]>(), It.IsAny<RedisValue[]>(), CommandFlags.None))
               .ReturnsAsync(RedisResult.Create(1));

        // Act
        await _redisService.SettleTradeAsync("Alice", "Bob", 50000m, 2);

        // Assert
        _mockDb.Verify(db => db.ScriptEvaluateAsync(
            It.Is<string>(s => s.Contains("HINCRBYFLOAT")),
            It.Is<RedisKey[]>(keys => keys.Length == 2 && keys[0] == "Alice" && keys[1] == "Bob"),
            It.Is<RedisValue[]>(vals => vals.Length == 2 && (string)vals[0] == "100000" && (string)vals[1] == "2"),
            CommandFlags.None), Times.Once);
    }

    [Fact]
    public async Task GetAllUsersAsync_Should_Return_All_Users()
    {
        // Arrange
        var mockServer = new Mock<IServer>();
        _mockMultiplexer.Setup(m => m.GetEndPoints(It.IsAny<bool>())).Returns(new[] { new System.Net.IPEndPoint(127, 80) });
        _mockMultiplexer.Setup(m => m.GetServer(It.IsAny<System.Net.EndPoint>(), It.IsAny<object>())).Returns(mockServer.Object);
        
        mockServer.Setup(s => s.Keys(It.IsAny<int>(), "user:*:balances", It.IsAny<int>(), It.IsAny<long>(), It.IsAny<int>(), CommandFlags.None))
                  .Returns(new RedisKey[] { "user:Alice:balances" });

        var hashEntries = new HashEntry[]
        {
            new HashEntry("USD", 50000.0),
            new HashEntry("BTC", 2.5)
        };
        _mockDb.Setup(db => db.HashGetAllAsync("user:Alice:balances", CommandFlags.None))
               .ReturnsAsync(hashEntries);

        // Act
        var users = await _redisService.GetAllUsersAsync();

        // Assert
        users.Should().ContainKey("Alice");
        users["Alice"]["USD"].Should().Be(50000.0);
    }
}
