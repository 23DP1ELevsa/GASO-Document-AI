<script setup>
import {
  House,
  ScanLine,
  Files,
  Settings2,
  ArrowUpRight,
  ArrowRight,
  ShieldCheck,
  Camera,
  ImagePlus,
  Layers,
  Crop,
  FileText,
  Sun,
  Moon,
  ChevronRight,
  CodeXml,
  Download,
  Sparkles,
  MonitorSmartphone,
  WifiOff,
  Check,
  ScanText,
  FolderOpen,
  LockKeyhole,
} from '@lucide/vue'
defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 22 },
})
const icons = {
  home: House,
  scan: ScanLine,
  documents: Files,
  settings: Settings2,
  external: ArrowUpRight,
  arrow: ArrowRight,
  shield: ShieldCheck,
  camera: Camera,
  gallery: ImagePlus,
  layers: Layers,
  crop: Crop,
  file: FileText,
  sun: Sun,
  moon: Moon,
  chevron: ChevronRight,
  github: CodeXml,
  download: Download,
  sparkles: Sparkles,
  device: MonitorSmartphone,
  offline: WifiOff,
  check: Check,
  ocr: ScanText,
  folder: FolderOpen,
  lock: LockKeyhole,
}
</script>

<template>
  <component :is="icons[name] || icons.file" :size="size" :stroke-width="1.7" aria-hidden="true" />
</template>
