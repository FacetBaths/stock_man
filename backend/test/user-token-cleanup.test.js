const mongoose = require('mongoose');
const User = require('../src/models/User');

describe('User Token Cleanup', () => {
  beforeAll(async () => {
    const testDBName = 'stock_manager_test_token_cleanup';
    await mongoose.connect(`mongodb://localhost:27017/${testDBName}`);
  });

  afterAll(async () => {
    await User.deleteMany({});
    await mongoose.connection.close();
  });

  afterEach(async () => {
    await User.deleteMany({});
  });

  describe('cleanExpiredTokens', () => {
    it('should remove tokens older than 7 days', async () => {
      const user = new User({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        role: 'viewer'
      });

      // Add some tokens with different ages
      const now = new Date();
      const eightDaysAgo = new Date(now - 8 * 24 * 60 * 60 * 1000);
      const fiveDaysAgo = new Date(now - 5 * 24 * 60 * 60 * 1000);
      const oneDayAgo = new Date(now - 1 * 24 * 60 * 60 * 1000);

      user.refreshTokens = [
        { token: 'expired1', createdAt: eightDaysAgo },
        { token: 'expired2', createdAt: eightDaysAgo },
        { token: 'valid1', createdAt: fiveDaysAgo },
        { token: 'valid2', createdAt: oneDayAgo }
      ];

      await user.save();

      // Clean expired tokens
      user.cleanExpiredTokens();

      expect(user.refreshTokens).toHaveLength(2);
      expect(user.refreshTokens.map(t => t.token)).toEqual(['valid1', 'valid2']);
    });

    it('should keep all tokens if none are expired', async () => {
      const user = new User({
        username: 'testuser2',
        email: 'test2@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        role: 'viewer'
      });

      const now = new Date();
      user.refreshTokens = [
        { token: 'token1', createdAt: new Date(now - 1 * 24 * 60 * 60 * 1000) },
        { token: 'token2', createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000) },
        { token: 'token3', createdAt: new Date(now - 6 * 24 * 60 * 60 * 1000) }
      ];

      await user.save();

      user.cleanExpiredTokens();

      expect(user.refreshTokens).toHaveLength(3);
    });
  });

  describe('addRefreshToken', () => {
    it('should clean expired tokens before adding new token', async () => {
      const user = new User({
        username: 'testuser3',
        email: 'test3@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        role: 'viewer'
      });

      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      user.refreshTokens = [
        { token: 'expired', createdAt: eightDaysAgo }
      ];

      await user.save();

      // Add new token - should clean expired ones
      await user.addRefreshToken('newtoken', 'test-agent', '127.0.0.1');

      expect(user.refreshTokens).toHaveLength(1);
      expect(user.refreshTokens[0].token).toBe('newtoken');
    });
  });

  describe('findByRefreshToken', () => {
    it('should return null for expired tokens', async () => {
      const user = new User({
        username: 'testuser4',
        email: 'test4@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        role: 'viewer'
      });

      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      user.refreshTokens = [
        { token: 'expiredtoken', createdAt: eightDaysAgo }
      ];

      await user.save();

      const foundUser = await User.findByRefreshToken('expiredtoken');
      expect(foundUser).toBeNull();

      // Verify the expired token was cleaned from the user
      const reloadedUser = await User.findById(user._id);
      expect(reloadedUser.refreshTokens).toHaveLength(0);
    });

    it('should return user for valid tokens', async () => {
      const user = new User({
        username: 'testuser5',
        email: 'test5@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        role: 'viewer'
      });

      await user.addRefreshToken('validtoken', 'test-agent', '127.0.0.1');

      const foundUser = await User.findByRefreshToken('validtoken');
      expect(foundUser).toBeTruthy();
      expect(foundUser.username).toBe('testuser5');
    });
  });

  describe('TTL Index Prevention', () => {
    it('should NOT delete users even if tokens are old', async () => {
      const user = new User({
        username: 'testuser6',
        email: 'test6@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        role: 'viewer'
      });

      // Create user with old token
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      user.refreshTokens = [
        { token: 'oldtoken', createdAt: eightDaysAgo }
      ];

      await user.save();
      const userId = user._id;

      // Wait a bit (simulating TTL monitor check time)
      await new Promise(resolve => setTimeout(resolve, 100));

      // User should still exist!
      const stillExists = await User.findById(userId);
      expect(stillExists).toBeTruthy();
      expect(stillExists.username).toBe('testuser6');
    });
  });
});
