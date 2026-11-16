<template>
  <section class="support-overview" :class="{ 'support-overview--compact': compact }" aria-label="Resumen de soporte">
    <div v-if="!compact" class="support-overview-heading">
      <i class="bi bi-chat-square-text" aria-hidden="true" />
      <h1>Tu bandeja de soporte</h1>
      <p>Elegí un ticket para conversar o una tarjeta para filtrar la lista.</p>
    </div>
    <div class="support-overview-cards">
      <button v-for="card in cards" :key="card.key" type="button" class="support-overview-card"
        :disabled="loading || card.count === null" :aria-pressed="filter === card.key"
        :title="card.count === null ? 'Este servidor todavía no informa este indicador' : card.label"
        @click="$emit('filter', card.key)">
        <i class="bi" :class="card.icon" aria-hidden="true" />
        <strong>{{ loading || card.count === null ? '—' : card.count }}</strong>
        <span>{{ card.label }}</span>
      </button>
    </div>
    <p v-if="!compact" class="support-overview-hint">Escape vuelve a este resumen sin cerrar el ticket.</p>
  </section>
</template>

<script>
export default {
  name: 'SupportOverview',
  props: { cards: { type: Array, default: () => [] }, filter: { type: String, default: null }, compact: Boolean, loading: Boolean },
  emits: ['filter'],
}
</script>

<style scoped>
.support-overview { margin: auto; padding: 32px; width: 100%; max-width: 820px; }
.support-overview-heading { text-align: center; margin-bottom: 28px; }
.support-overview-heading > i { font-size: 36px; color: var(--bs-secondary-color); }
.support-overview h1 { font-size: 23px; margin: 16px 0 10px; }
.support-overview p { font-size: 14px; color: var(--bs-secondary-color); }
.support-overview-cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.support-overview-card { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 20px; border: 1px solid var(--bs-border-color); border-radius: 16px; background: var(--bs-body-bg); color: var(--bs-body-color); text-align: left; }
.support-overview-card > i { color: #198754; font-size: 20px; }
.support-overview-card strong { font-size: 30px; font-weight: 650; line-height: 1.1; }
.support-overview-card span { font-size: 13px; }
.support-overview-card:hover, .support-overview-card[aria-pressed="true"] { border-color: #198754; background: rgba(25, 135, 84, 0.05); }
.support-overview-card:focus-visible { outline: 3px solid #80b59a; outline-offset: 2px; }
.support-overview-card:disabled { opacity: .6; cursor: default; }
.support-overview-hint { text-align: center; margin-top: 28px; }
.support-overview--compact { padding: 12px 0 4px; }
.support-overview--compact .support-overview-cards { gap: 6px; }
.support-overview--compact .support-overview-card { padding: 10px; gap: 5px; border-radius: 12px; }
.support-overview--compact .support-overview-card > i { display: none; }
.support-overview--compact .support-overview-card strong { font-size: 24px; }
@media (min-width: 768px) and (max-width: 1023px) {
  .support-overview { padding: 20px; }
  .support-overview-cards { grid-template-columns: 1fr; }
  .support-overview-card { flex-direction: row; align-items: center; padding: 16px; }
  .support-overview-card strong { font-size: 25px; }
}
</style>
