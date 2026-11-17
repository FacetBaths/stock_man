const express = require('express');
const request = require('supertest');

jest.mock('../src/middleware/authEnhanced', () => ({
  auth: (req, res, next) => {
    req.user = { username: 'testuser' };
    next();
  },
  requireRole: () => (req, res, next) => next(),
  requireWriteAccess: (req, res, next) => next()
}));

const SKU = require('../src/models/SKU');
const Category = require('../src/models/Category');
const Tag = require('../src/models/Tag');

const app = express();
app.use('/inventory', require('../src/routes/inventory'));
app.use('/tools', require('../src/routes/tools'));
app.use('/tags', require('../src/routes/tags'));

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(Category, 'find').mockReturnValue({ select: jest.fn().mockResolvedValue([]) });
});

afterEach(() => jest.restoreAllMocks());

test.each(['/inventory', '/tools/inventory'])('%s matches barcodes before pagination', async endpoint => {
  const aggregate = jest.spyOn(SKU, 'aggregate').mockResolvedValue([]);
  await request(app).get(endpoint).query({ search: '00123456789' }).expect(200);
  for (const [pipeline] of aggregate.mock.calls) {
    const matchIndex = pipeline.findIndex(stage => stage.$match?.$or?.some(clause => clause.barcode));
    expect(matchIndex).toBeGreaterThanOrEqual(0);
    expect(pipeline[matchIndex].$match.$or).toContainEqual({
      barcode: { $regex: '00123456789', $options: 'i' }
    });
    const paginationIndex = pipeline.findIndex(stage => '$skip' in stage);
    if (paginationIndex >= 0) expect(matchIndex).toBeLessThan(paginationIndex);
  }
});

test.each(['/tags', '/tools/tags'])('%s resolves barcode matches to SKU references for filtering and counts', async endpoint => {
  const findSKU = jest.spyOn(SKU, 'find').mockReturnValue({
    select: jest.fn().mockResolvedValue([{ _id: 'matching-sku' }])
  });
  const count = jest.spyOn(Tag, 'countDocuments').mockResolvedValue(0);
  const chain = {};
  for (const method of ['sort', 'skip', 'limit']) chain[method] = jest.fn().mockReturnValue(chain);
  chain.then = resolve => Promise.resolve([]).then(resolve);
  const findTag = jest.spyOn(Tag, 'find').mockReturnValue(chain);

  await request(app).get(endpoint).query({ search: '00123456789', status: 'active' }).expect(200);

  expect(findSKU.mock.calls[0][0].$or).toContainEqual({ barcode: /00123456789/i });
  const filter = findTag.mock.calls[0][0];
  expect(filter.status).toBe('active');
  expect(filter.$or).toContainEqual({ 'sku_items.sku_id': { $in: ['matching-sku'] } });
  expect(count).toHaveBeenCalledWith(filter);
});
