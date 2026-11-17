const express = require('express');
const request = require('supertest');
const { summarizeInstanceLocations } = require('../src/utils/inventoryLocations');

jest.mock('../src/middleware/authEnhanced', () => ({
  auth: (req, res, next) => next(),
  requireRole: () => (req, res, next) => next(),
  requireWriteAccess: (req, res, next) => next()
}));

const SKU = require('../src/models/SKU');
const Instance = require('../src/models/Instance');
const app = express();
app.use('/inventory', require('../src/routes/inventory'));

beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

test.each([
  [['HQ', 'HQ'], [{ location: 'HQ', quantity: 2 }]],
  [['Warehouse A', 'Van 2', 'Warehouse A'], [
    { location: 'Van 2', quantity: 1 },
    { location: 'Warehouse A', quantity: 2 }
  ]],
  [[' HQ ', 'HQ', '', '  ', null, undefined], [
    { location: 'HQ', quantity: 2 },
    { location: null, quantity: 4 }
  ]],
  [[], []]
])('groups instance locations without losing units: %j', (locations, expected) => {
  expect(summarizeInstanceLocations(locations)).toEqual(expected);
  expect(summarizeInstanceLocations(locations).reduce((sum, entry) => sum + entry.quantity, 0))
    .toBe(locations.length);
});

test('the location is an instance field, not a SKU field', () => {
  expect(Instance.schema.path('location')).toBeDefined();
  expect(SKU.schema.path('location')).toBeUndefined();
});

test('API derives the summary from all instances and hides temporary location arrays', async () => {
  const aggregate = jest.spyOn(SKU, 'aggregate')
    .mockResolvedValueOnce([{ total: 1 }])
    .mockResolvedValueOnce([{
      _id: 'sku-1',
      total_quantity: 4,
      available_quantity: 2,
      reserved_quantity: 2,
      location: 'Obsolete SKU location',
      _instance_locations: ['Warehouse A', 'Warehouse A', 'Van 2', null]
    }]);

  const response = await request(app).get('/inventory').expect(200);
  expect(response.body.inventory[0].location_summary).toEqual([
    { location: 'Van 2', quantity: 1 },
    { location: 'Warehouse A', quantity: 2 },
    { location: null, quantity: 1 }
  ]);
  expect(response.body.inventory[0]).not.toHaveProperty('_instance_locations');
  expect(response.body.pagination.total_items).toBe(1);
  const pipeline = aggregate.mock.calls[1][0];
  const projectionIndex = pipeline.findIndex(stage => stage.$addFields?._instance_locations);
  expect(pipeline[projectionIndex].$addFields._instance_locations).toEqual({
    $map: { input: '$all_instances', as: 'instance', in: { $ifNull: ['$$instance.location', null] } }
  });
  const cleanupIndex = pipeline.findIndex(stage => stage.$unset?.includes('all_instances'));
  expect(projectionIndex).toBeLessThan(cleanupIndex);
});

test('an SKU without current instances has no location summary', async () => {
  jest.spyOn(SKU, 'aggregate')
    .mockResolvedValueOnce([{ total: 1 }])
    .mockResolvedValueOnce([{ _id: 'empty-sku', total_quantity: 0, _instance_locations: [] }]);
  const response = await request(app).get('/inventory').expect(200);
  expect(response.body.inventory[0].location_summary).toEqual([]);
});
