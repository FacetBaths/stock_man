const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { parse, compileScript } = require('@vue/compiler-sfc')
const vue = require('vue')
const pinia = require('pinia')

function evaluate(source, imports) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText, {
    exports,
    console: { log() {}, error() {} },
    require: name => {
      assert.ok(name in imports, `Unexpected import ${name}`)
      return imports[name]
    }
  })
  return exports
}

const filename = path.join(__dirname, '../src/components/InstanceLocationEditor.vue')
const { descriptor } = parse(fs.readFileSync(filename, 'utf8'))
const { content } = compileScript(descriptor, { id: 'instance-location-editor' })
const fixtures = [
  { _id: 'instance-1', location: 'HQ', acquisition_date: '2026-01-01', tag_id: null },
  { _id: 'instance-2', location: 'Van 2', acquisition_date: '2026-02-01',
    tag_id: { _id: 'tag-1', customer_name: 'Alice', tag_type: 'reserved' } }
]

function editor(overrides = {}) {
  const calls = []
  const events = []
  const savingStates = []
  const auth = { canWrite: true }
  const props = { skuId: 'sku-1', disabled: false }
  let dispose
  const store = {
    fetchInstanceLocations: async () => fixtures,
    updateInstance: async (id, updates) => {
      calls.push({ id, ...updates })
      return { instance: { _id: id, ...updates } }
    },
    ...overrides
  }
  const compiled = evaluate(content, {
    vue: { ...vue, watch() {}, onBeforeUnmount: callback => { dispose = callback } },
    '@/stores/auth': { useAuthStore: () => auth },
    '@/stores/inventory': { useInventoryStore: () => store }
  })
  const state = compiled.default.setup(props, {
    expose() {},
    emit: (event, value) => event === 'saving-change' ? savingStates.push(value) : events.push(event)
  })
  return { state, auth, props, calls, events, savingStates, dispose: () => dispose() }
}

test('loads both available and tagged instances and edits only the selected instance', async () => {
  const { state, calls, events, savingStates } = editor()
  await state.loadInstances()
  assert.equal(state.rows.value.length, 2)
  const [first, second] = state.rows.value
  first.draftLocation = '  Rack A  '
  assert.equal(state.canSave(first), true)
  await state.saveLocation(first)
  assert.deepEqual(calls, [{ id: 'instance-1', location: 'Rack A' }])
  assert.equal(first.savedLocation, 'Rack A')
  assert.equal(second.savedLocation, 'Van 2')
  assert.equal(fixtures[0].location, 'HQ')
  assert.deepEqual(events, ['saved'])
  assert.deepEqual(savingStates, [true, false])
  assert.equal(state.canSave(first), false)
  const assignment = state.columns.find(column => column.name === 'assignment')
  assert.equal(assignment.field(second), 'Alice (reserved)')
})

test('permissions, parent saves, unchanged values, and duplicate clicks block updates', async () => {
  const { state, auth, props, calls } = editor()
  await state.loadInstances()
  const row = state.rows.value[0]
  await state.saveLocation(row)
  row.draftLocation = 'New location'
  auth.canWrite = false
  await state.saveLocation(row)
  auth.canWrite = true
  props.disabled = true
  await state.saveLocation(row)
  props.disabled = false
  state.savingId.value = 'instance-2'
  await state.saveLocation(row)
  assert.equal(calls.length, 0)
})

test('a failed save preserves the draft and original location for retry', async () => {
  const { state, events } = editor({
    updateInstance: async () => { throw { response: { data: { message: 'Update failed' } } } }
  })
  await state.loadInstances()
  const row = state.rows.value[0]
  row.draftLocation = 'Rack B'
  await state.saveLocation(row)
  assert.equal(row.draftLocation, 'Rack B')
  assert.equal(row.savedLocation, 'HQ')
  assert.equal(state.error.value, 'Update failed')
  assert.equal(state.savingId.value, null)
  assert.deepEqual(events, [])
})

test('locations can be cleared without changing sibling instances', async () => {
  const { state, calls } = editor()
  await state.loadInstances()
  state.rows.value[0].draftLocation = ' '
  await state.saveLocation(state.rows.value[0])
  assert.deepEqual(calls, [{ id: 'instance-1', location: '' }])
  assert.equal(state.rows.value[1].savedLocation, 'Van 2')
})

test('load failures are visible, and late responses cannot replace a newly selected SKU', async () => {
  const failed = editor({ fetchInstanceLocations: async () => { throw new Error('offline') } })
  await failed.state.loadInstances()
  assert.equal(failed.state.error.value, 'Failed to load instances')
  assert.equal(failed.state.loading.value, false)

  const pending = []
  const { state, props } = editor({
    fetchInstanceLocations: () => new Promise(resolve => pending.push(resolve))
  })
  const first = state.loadInstances()
  props.skuId = 'sku-2'
  const second = state.loadInstances()
  pending[1]([{ ...fixtures[1], _id: 'new-instance' }])
  await second
  pending[0](fixtures)
  await first
  assert.equal(state.rows.value.length, 1)
  assert.equal(state.rows.value[0]._id, 'new-instance')
})

test('closing the editor ignores an in-flight save response', async () => {
  let finish
  const { state, events, dispose } = editor({
    updateInstance: () => new Promise(resolve => { finish = resolve })
  })
  await state.loadInstances()
  state.rows.value[0].draftLocation = 'Rack C'
  const saving = state.saveLocation(state.rows.value[0])
  dispose()
  finish({ instance: { location: 'Rack C' } })
  await saving
  assert.deepEqual(events, [])
})

test('Pinia uses the instance API without changing dashboard loading or the shared instance list', async () => {
  pinia.setActivePinia(pinia.createPinia())
  const calls = []
  const source = fs.readFileSync(path.join(__dirname, '../src/stores/inventory.ts'), 'utf8')
  const { useInventoryStore } = evaluate(source, {
    pinia,
    vue,
    '@/utils/api': {
      instancesApi: {
        getInstances: async (id, params) => { calls.push({ id, ...params }); return { instances: fixtures } },
        updateInstance: async (id, updates) => { calls.push({ id, ...updates }); return { instance: updates } }
      }
    }
  })
  const store = useInventoryStore()
  const result = await store.fetchInstanceLocations('sku-1')
  assert.equal(result.length, 2)
  assert.equal(store.instances.length, 0)
  assert.equal(store.isLoading, false)
  await store.updateInstance('instance-2', { location: 'Rack D' })
  assert.deepEqual(calls, [
    { id: 'sku-1', include_tagged: true },
    { id: 'instance-2', location: 'Rack D' }
  ])
})
