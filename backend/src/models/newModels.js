// Central export file for all new redesigned models
// This provides a single import point for the new architecture

const Customer = require('./Customer');
const Category = require('./Category');
const SKUNew = require('./SKUNew');
const ItemNew = require('./ItemNew');
const TagNew = require('./TagNew');
const Inventory = require('./Inventory');
const AuditLog = require('./AuditLog');

module.exports = {
  Customer,
  Category,
  SKUNew,
  ItemNew,
  TagNew,
  Inventory,
  AuditLog
};

// Export individual models for direct import
module.exports.Customer = Customer;
module.exports.Category = Category;
module.exports.SKUNew = SKUNew;
module.exports.ItemNew = ItemNew;
module.exports.TagNew = TagNew;
module.exports.Inventory = Inventory;
module.exports.AuditLog = AuditLog;
