<template><consumo-serper v-if="record && record.id" :client-id="record.id" /></template>
<script>
import ConsumoSerper from '@/components/serper/ConsumoSerper.vue'
export default { name: 'ClientSerperTab', components: { ConsumoSerper }, props: { record: { type: Object, default: null } } }
</script>
