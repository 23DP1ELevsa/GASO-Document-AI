<script setup>
import AppIcon from './AppIcon.vue'
import { t } from '../locales'
defineProps({ expanded: Boolean })
</script>

<template>
  <div class="local-notice">
    <div class="notice-icon"><AppIcon name="shield" :size="25" /></div>
    <div>
      <h3>{{ t('common.localTitle') }}</h3>
      <p>{{ t(expanded ? 'common.localDescription' : 'common.localShort') }}</p>
    </div>
    <RouterLink
      v-if="!expanded"
      to="/settings"
      class="notice-link"
      :aria-label="t('common.learnMore')"
      ><AppIcon name="arrow"
    /></RouterLink>
  </div>
</template>
