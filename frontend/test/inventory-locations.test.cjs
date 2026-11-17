const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { parse, compileScript } = require('@vue/compiler-sfc')
const vue = require('vue')
const { renderToString } = require('@vue/server-renderer')

const filename = path.join(__dirname, '../src/components/InventoryLocations.vue')
const { descriptor } = parse(fs.readFileSync(filename, 'utf8'))
const { content } = compileScript(descriptor, { id: 'inventory-locations', inlineTemplate: true })
const exportsObject = {}
vm.runInNewContext(ts.transpileModule(content, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText, {
  exports: exportsObject,
  require: name => {
    assert.equal(name, 'vue')
    return vue
  }
})

async function render(props) {
  const app = vue.createSSRApp(exportsObject.default, props)
  // Render the real component with light Quasar stand-ins; no browser required.
  for (const name of ['q-list', 'q-item', 'q-item-section', 'q-item-label', 'q-icon', 'q-tooltip']) {
    app.component(name, {
      setup: (_, { slots }) => () => vue.h('div', slots.default?.())
    })
  }
  return renderToString(app)
}

test('renders each instance location and its quantity', async () => {
  const html = await render({
    totalQuantity: 4,
    locations: [{ location: 'Warehouse A', quantity: 3 }, { location: 'Van 2', quantity: 1 }]
  })
  assert.match(html, /Warehouse A.*?\(3\)/s)
  assert.match(html, /Van 2.*?\(1\)/s)
  assert.doesNotMatch(html, /No location|Location unavailable/)
})

test('missing locations are distinguished from zero stock', async () => {
  const missing = await render({ totalQuantity: 2, locations: [{ location: null, quantity: 2 }] })
  assert.match(missing, /No location.*?\(2\)/s)
  const empty = await render({ totalQuantity: 0, locations: [] })
  assert.match(empty, /No stock/)
  assert.doesNotMatch(empty, /No location/)
})

test('an older API response is not falsely described as having no location', async () => {
  assert.match(await render({ totalQuantity: 2 }), /Location unavailable/)
})

test('location names render as escaped text', async () => {
  const html = await render({ totalQuantity: 1, locations: [{ location: '<Rack & Shelf>', quantity: 1 }] })
  assert.match(html, /&lt;Rack &amp; Shelf&gt;/)
})

test('dashboard cards show summaries and its edit dialog exposes instance editing, not SKU locations', () => {
  const table = fs.readFileSync(path.join(__dirname, '../src/components/InventoryTable.vue'), 'utf8')
  assert.equal((table.match(/:locations="item\.location_summary"/g) || []).length, 2)
  assert.doesNotMatch(table, /item\.location\b/)
  const modal = fs.readFileSync(path.join(__dirname, '../src/components/EditItemModal.vue'), 'utf8')
  assert.match(modal, /<InstanceLocationEditor/)
  assert.doesNotMatch(modal, /item\.primary_location\b/)
  const skuDialog = fs.readFileSync(path.join(__dirname, '../src/components/SKUFormDialog.vue'), 'utf8')
  assert.doesNotMatch(skuDialog, /InstanceLocationEditor/)
})
