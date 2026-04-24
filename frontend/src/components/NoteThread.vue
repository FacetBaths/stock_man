<script setup lang="ts">
import { computed, ref } from 'vue'
import { useQuasar } from 'quasar'
import type { Tag, TagNote } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { useTagStore } from '@/stores/tag'

const props = defineProps<{
  tag: Tag
  // When true, hide the compose box even if the user has write access.
  readonly?: boolean
}>()

const authStore = useAuthStore()
const tagStore = useTagStore()
const $q = useQuasar()

// Thread, oldest first.
const orderedNotes = computed<TagNote[]>(() => {
  const notes = Array.isArray(props.tag.notes) ? [...props.tag.notes] : []
  notes.sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return ta - tb
  })
  return notes
})

const canCompose = computed(() => !props.readonly && authStore.canWrite)

// --- compose state ---
const newMessage = ref('')
const isSubmitting = ref(false)

const submitNew = async () => {
  const message = newMessage.value.trim()
  if (!message) return
  try {
    isSubmitting.value = true
    await tagStore.addNote(props.tag._id, message)
    newMessage.value = ''
  } catch (err: any) {
    $q.notify({
      type: 'negative',
      message: err.response?.data?.message || err.message || 'Failed to post note',
      timeout: 4000
    })
  } finally {
    isSubmitting.value = false
  }
}

// --- edit state ---
const editingNoteId = ref<string | null>(null)
const editDraft = ref('')
const isSavingEdit = ref(false)

const startEdit = (note: TagNote) => {
  editingNoteId.value = note._id
  editDraft.value = note.message
}

const cancelEdit = () => {
  editingNoteId.value = null
  editDraft.value = ''
}

const saveEdit = async (note: TagNote) => {
  const message = editDraft.value.trim()
  if (!message) return
  if (message === note.message) {
    cancelEdit()
    return
  }
  try {
    isSavingEdit.value = true
    await tagStore.updateNote(props.tag._id, note._id, message)
    cancelEdit()
  } catch (err: any) {
    $q.notify({
      type: 'negative',
      message: err.response?.data?.message || err.message || 'Failed to update note',
      timeout: 4000
    })
  } finally {
    isSavingEdit.value = false
  }
}

const confirmDelete = (note: TagNote) => {
  $q.dialog({
    title: 'Delete note',
    message: 'Delete this note? It will remain in the thread marked as [deleted] for history.',
    cancel: true,
    persistent: true
  }).onOk(async () => {
    try {
      await tagStore.deleteNote(props.tag._id, note._id)
    } catch (err: any) {
      $q.notify({
        type: 'negative',
        message: err.response?.data?.message || err.message || 'Failed to delete note',
        timeout: 4000
      })
    }
  })
}

// --- presentation helpers ---
const formatTimestamp = (iso?: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString()
}

const authorInitial = (name: string) => {
  if (!name) return '?'
  return name.trim().charAt(0).toUpperCase()
}

// Treat system notes (and legacy notes whose author couldn't be recovered)
// with a consistent label so the thread never shows "Unknown".
const displayAuthor = (note: TagNote) => {
  const author = (note.author || '').trim()
  if (note.kind === 'system' || !author || author.toLowerCase() === 'system') {
    return 'System'
  }
  return author
}

const isAuthoredByCurrentUser = (note: TagNote) => {
  if (note.kind === 'system') return false
  return !!authStore.user && note.author === authStore.user.username
}
</script>

<template>
  <div class="note-thread">
    <div v-if="orderedNotes.length === 0" class="text-grey-6 text-body2 q-pa-sm">
      No notes yet. {{ canCompose ? 'Start the conversation below.' : '' }}
    </div>

    <q-list separator class="note-thread__list">
      <q-item
        v-for="note in orderedNotes"
        :key="note._id"
        class="note-item"
        :class="{
          'note-item--system': note.kind === 'system',
          'note-item--deleted': !!note.deleted_at,
          'note-item--self': isAuthoredByCurrentUser(note) && note.kind !== 'system'
        }"
      >
        <q-item-section avatar top>
          <q-avatar
            :color="note.kind === 'system' ? 'grey-7' : (isAuthoredByCurrentUser(note) ? 'primary' : 'secondary')"
            text-color="white"
            size="32px"
          >
            <q-icon v-if="note.kind === 'system'" name="smart_toy" size="18px" />
            <span v-else>{{ authorInitial(displayAuthor(note)) }}</span>
          </q-avatar>
        </q-item-section>

        <q-item-section>
          <q-item-label class="row items-center q-gutter-xs">
            <span class="text-weight-medium">{{ displayAuthor(note) }}</span>
            <q-chip
              v-if="note.kind === 'system'"
              dense
              size="xs"
              color="grey-6"
              text-color="white"
              label="system"
            />
            <span class="text-caption text-grey-7">{{ formatTimestamp(note.createdAt) }}</span>
            <q-chip
              v-if="note.edited_at && !note.deleted_at"
              dense
              size="xs"
              color="amber-8"
              text-color="white"
              :label="`edited ${formatTimestamp(note.edited_at)}${note.edited_by ? ' by ' + note.edited_by : ''}`"
            />
            <q-chip
              v-if="note.deleted_at"
              dense
              size="xs"
              color="negative"
              text-color="white"
              :label="`deleted ${formatTimestamp(note.deleted_at)}${note.deleted_by ? ' by ' + note.deleted_by : ''}`"
            />
          </q-item-label>

          <!-- Edit mode -->
          <div v-if="editingNoteId === note._id" class="q-mt-xs">
            <q-input
              v-model="editDraft"
              type="textarea"
              autogrow
              outlined
              dense
              :maxlength="2000"
              counter
              :disable="isSavingEdit"
              @keydown.enter.ctrl.prevent="saveEdit(note)"
            />
            <div class="row q-gutter-sm q-mt-xs justify-end">
              <q-btn flat size="sm" label="Cancel" @click="cancelEdit" :disable="isSavingEdit" />
              <q-btn
                color="primary"
                size="sm"
                :loading="isSavingEdit"
                :disable="!editDraft.trim() || editDraft.trim() === note.message"
                label="Save"
                @click="saveEdit(note)"
              />
            </div>
          </div>

          <!-- Read mode -->
          <q-item-label
            v-else
            class="note-item__body"
            :class="{ 'text-grey-6 text-italic': !!note.deleted_at }"
          >
            {{ note.message }}
          </q-item-label>
        </q-item-section>

        <q-item-section side top v-if="editingNoteId !== note._id && tagStore.canEditNote(note)">
          <div class="row q-gutter-xs">
            <q-btn
              flat
              dense
              round
              size="sm"
              icon="edit"
              @click="startEdit(note)"
            >
              <q-tooltip>Edit note</q-tooltip>
            </q-btn>
            <q-btn
              flat
              dense
              round
              size="sm"
              icon="delete"
              color="negative"
              @click="confirmDelete(note)"
            >
              <q-tooltip>Delete note</q-tooltip>
            </q-btn>
          </div>
        </q-item-section>
      </q-item>
    </q-list>

    <!-- Compose -->
    <div v-if="canCompose" class="note-compose q-mt-sm">
      <q-input
        v-model="newMessage"
        type="textarea"
        autogrow
        outlined
        dense
        :maxlength="2000"
        counter
        placeholder="Add a note to the thread..."
        :disable="isSubmitting"
        @keydown.enter.ctrl.prevent="submitNew"
      />
      <div class="row justify-end q-mt-xs">
        <q-btn
          color="primary"
          icon="send"
          label="Post note"
          :loading="isSubmitting"
          :disable="!newMessage.trim()"
          @click="submitNew"
        />
      </div>
    </div>
    <div v-else-if="!readonly" class="text-caption text-grey-6 q-mt-sm">
      You don't have permission to post notes on this tag.
    </div>
  </div>
</template>

<style scoped>
.note-thread__list {
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 6px;
  background: #fafafa;
}
.note-item {
  align-items: flex-start;
}
.note-item--system {
  background: rgba(0, 0, 0, 0.03);
}
.note-item--self {
  background: rgba(25, 118, 210, 0.04);
}
.note-item--deleted {
  opacity: 0.7;
}
.note-item__body {
  white-space: pre-wrap;
  word-break: break-word;
  margin-top: 2px;
}
.note-compose :deep(.q-field__native) {
  min-height: 56px;
}
</style>
