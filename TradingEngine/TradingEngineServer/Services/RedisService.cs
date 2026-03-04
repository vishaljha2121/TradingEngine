using StackExchange.Redis;
using System.Text.Json;

namespace TradingEngineServer.Core.Services;

public class RedisService
{
    private readonly IConnectionMultiplexer _redis;
    private readonly IDatabase _db;

    public RedisService(string connectionString)
    {
        _redis = ConnectionMultiplexer.Connect(connectionString);
        _db = _redis.GetDatabase();
    }

    // Initialize a user with default balances if they don't exist
    public async Task InitializeUserAsync(string userId)
    {
        var key = $"user:{userId}:balances";
        if (!await _db.KeyExistsAsync(key))
        {
            await _db.HashSetAsync(key, new HashEntry[]
            {
                new HashEntry("USD", 100000.0),
                new HashEntry("BTC", 5.0)
            });
        }
    }

    // Get a user's balances
    public async Task<Dictionary<string, double>> GetUserBalancesAsync(string userId)
    {
        var key = $"user:{userId}:balances";
        var hash = await _db.HashGetAllAsync(key);
        var balances = new Dictionary<string, double>();
        foreach (var entry in hash)
        {
            balances[entry.Name!] = (double)entry.Value;
        }
        return balances;
    }

    // Get all users and their balances (for testing/admin purposes)
    public async Task<Dictionary<string, Dictionary<string, double>>> GetAllUsersAsync()
    {
        var server = _redis.GetServer(_redis.GetEndPoints().First());
        var keys = server.Keys(pattern: "user:*:balances");
        var allUsers = new Dictionary<string, Dictionary<string, double>>();

        foreach (var key in keys)
        {
            // Extract the user ID from the key "user:Bob:balances"
            var parts = key.ToString().Split(':');
            if (parts.Length == 3)
            {
                var userId = parts[1];
                allUsers[userId] = await GetUserBalancesAsync(userId);
            }
        }
        return allUsers;
    }

    // Delete a user's wallet
    public async Task DeleteUserAsync(string userId)
    {
        var key = $"user:{userId}:balances";
        await _db.KeyDeleteAsync(key);
    }

    // Adjust a user's USD balance for the Prediction Mini-Game
    public async Task AdjustBalanceAsync(string userId, double amountUSD)
    {
        var key = $"user:{userId}:balances";
        await _db.HashIncrementAsync(key, "USD", amountUSD);
    }

    // Update balances atomically upon a trade
    public async Task SettleTradeAsync(string buyerId, string sellerId, decimal price, int size)
    {
        var costStr = (price * size).ToString();
        var sizeStr = size.ToString();

        // Use a Lua script for atomic settlement to prevent race conditions
        string script = @"
            local buyerId = KEYS[1]
            local sellerId = KEYS[2]
            local cost = tonumber(ARGV[1])
            local size = tonumber(ARGV[2])

            local buyerKey = 'user:' .. buyerId .. ':balances'
            local sellerKey = 'user:' .. sellerId .. ':balances'

            -- We don't do strict balance checks here for the demo, 
            -- but in a real system we would verify balances >= cost.
            
            _G.redis.call('HINCRBYFLOAT', buyerKey, 'USD', -cost)
            _G.redis.call('HINCRBYFLOAT', buyerKey, 'BTC', size)

            _G.redis.call('HINCRBYFLOAT', sellerKey, 'USD', cost)
            _G.redis.call('HINCRBYFLOAT', sellerKey, 'BTC', -size)
            
            return 1
        ";

        await _db.ScriptEvaluateAsync(script, 
            new RedisKey[] { buyerId, sellerId }, 
            new RedisValue[] { costStr, sizeStr });
    }
}
