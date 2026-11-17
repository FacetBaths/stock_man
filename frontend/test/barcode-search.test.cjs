const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { parse, compileScript } = require('@vue/compiler-sfc')
const vue = require('vue')

function evaluate(source, imports = {}) {
  const exports = {}
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText
  vm.runInNewContext(code, {
    exports,
    require: name => {
      if (!(name in imports)) throw new Error(`Unexpected import: ${name}`)
      return imports[name]
    },
    setTimeout: () => 0,
    console: { log() {}, error() {} }
  })
  return exports
}

const search = evaluate(fs.readFileSync(path.join(__dirname, '../src/utils/search.ts'), 'utf8'))
const sku = { _id: 'sku-1', sku_code: 'FR-001', barcode: '001AbC789', name: 'Wall Panel', category_id: 'cat-1' }
const tag = {
  _id: 'tag-1',
  customer_name: 'Alice',
  project_name: 'Kitchen',
  sku_items: [{ sku_id: sku, selected_instance_ids: ['i1', 'i2'] }]
}

// Execute the actual SFC setup code without mounting a UI or making API requests.
function component(name) {
  const filename = path.join(__dirname, `../src/components/${name}.vue`)
  const { descriptor } = parse(fs.readFileSync(filename, 'utf8'))
  const script = compileScript(descriptor, { id: name })
  const compiled = evaluate(script.content, {
    vue: { ...vue, watch() {}, onMounted() {} },
    '@/utils/search': search,
    '@/utils/api': {},
    '@/types': { TAG_TYPES: [] },
    '@/stores/auth': { useAuthStore: () => ({}) },
    '@/stores/category': { useCategoryStore: () => ({ categories: [] }) },
    '@/utils/formatting': { formatCategoryName: value => value }
  })
  return compiled.default.setup({ show: true }, { expose() {}, emit() {} })
}

test('search supports partial barcodes; scans require a full barcode or SKU code', () => {
  assert.equal(search.matchesSKUSearch(sku, ' abc '), true)
  assert.equal(search.matchesSKUIdentifier(sku, ' 001abc789\r\n'), true)
  assert.equal(search.matchesSKUIdentifier(sku, ' fr-001 '), true)
  assert.equal(search.matchesSKUIdentifier(sku, '001'), false)
  assert.equal(search.matchesSKUIdentifier(sku, '1AbC789'), false)
  assert.equal(search.matchesSKUIdentifier({}, ''), false)
  assert.equal(search.matchesSKUSearch(null, '001'), false)
  assert.equal(search.matchesTagSearch(tag, 'abc'), true)
  assert.equal(search.matchesTagSearch(tag, 'ALICE'), true)
  assert.equal(search.matchesTagSearch(tag, 'kitchen'), true)
  assert.equal(search.matchesTagSearch({ customer_name: '', sku_items: [{ sku_id: null }, { sku_id: 'id' }] }, '001'), false)
})

test('create tag can browse and repeatedly scan a barcode without duplicating the SKU or exceeding stock', async () => {
  const state = component('CreateTagModal')
  state.availableSKUs.value = [{ sku, available_quantity: 2 }]
  state.skuSearchQuery.value = 'abc'
  assert.equal(state.filteredSKUs.value.length, 1)
  for (const code of ['001abc789', 'fr-001', '001abc789']) {
    state.skuInput.value = code
    await state.handleSkuInput()
  }
  assert.equal(state.taggedSKUs.value.length, 1)
  assert.equal(state.taggedSKUs.value[0].quantity, 2)
  assert.match(state.error.value, /Maximum available quantity/)
})

test('staging preserves barcode data and increments only the matching item up to its quantity', () => {
  const state = component('StageTagsDialog')
  state.tags.value = [tag]
  state.customerFilter.value = 'abc'
  assert.equal(state.filteredTags.value.length, 1)
  state.selectTag(tag)
  assert.equal(state.checklistItems.value[0].barcode, sku.barcode)
  for (let i = 0; i < 3; i++) {
    state.scannedBarcode.value = sku.barcode
    state.processScan()
  }
  assert.equal(state.checklistItems.value[0].staged_qty, 2)
  state.customerFilter.value = null
  assert.equal(state.filteredTags.value.length, 1)
})

test('fulfillment preserves barcode data and selects the scanned item', async () => {
  const state = component('FulfillTagsDialog')
  state.tags.value = [tag]
  state.customerFilter.value = 'abc'
  assert.equal(state.filteredTags.value.length, 1)
  state.selectTag(tag)
  const item = state.fulfillmentItems.value[0]
  assert.equal(item.barcode, sku.barcode)
  item.selected = false
  item.fulfill_quantity = 0
  state.scannedBarcode.value = '001abc789'
  await state.processScan()
  assert.equal(item.selected, true)
  assert.equal(item.fulfill_quantity, 1)
  state.scannedBarcode.value = 'not-a-barcode'
  await state.processScan()
  assert.match(state.error.value, /No matching SKU/)
})
