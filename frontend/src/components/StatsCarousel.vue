<template>
  <div class="stats-container">
    <!-- Desktop: Regular grid layout -->
    <div class="desktop-stats hidden-xs-only">
      <div class="glass-card q-pa-lg">
        <div class="row q-col-gutter-md justify-around">
          <div v-for="(stat, index) in stats" :key="index" :class="stat.colClass || 'col-12 col-sm-6 col-md-3'">
            <q-card class="stat-card glass-stat-card flex-grow">
              <q-card-section class="text-center q-pa-md">
                <q-circular-progress
                  v-if="isLoading"
                  indeterminate
                  size="50px"
                  :color="stat.iconColor || 'primary'"
                />
                <div v-else>
                  <div v-if="stat.icon" class="q-mb-sm">
                    <q-icon :name="stat.icon" size="32px" :color="stat.iconColor || 'primary'" />
                  </div>
                  <div class="text-h4 text-weight-bold q-mb-xs" :class="stat.valueClass">
                    {{ stat.value }}
                    <q-tooltip v-if="stat.tooltip" class="bg-dark text-white">
                      {{ stat.tooltip }}
                    </q-tooltip>
                  </div>
                  <div class="text-subtitle2 text-grey-7">{{ stat.label }}</div>
                </div>
              </q-card-section>
            </q-card>
          </div>
        </div>
      </div>
    </div>

    <!-- Mobile: Swipeable carousel -->
    <div class="mobile-stats visible-xs-only">
      <div class="glass-card q-pa-md">
        <q-carousel
          v-model="currentSlide"
          swipeable
          animated
          :arrows="false"
          :navigation="false"
          infinite
          :autoplay="false"
          height="160px"
          class="stats-carousel"
        >
          <q-carousel-slide
            v-for="(stat, index) in stats"
            :key="index"
            :name="index"
            class="carousel-slide"
          >
            <div class="mobile-stat-content">
              <q-circular-progress
                v-if="isLoading"
                indeterminate
                size="50px"
                :color="stat.iconColor || 'primary'"
              />
              <div v-else class="text-center">
                <div v-if="stat.icon" class="q-mb-md">
                  <q-icon :name="stat.icon" size="48px" :color="stat.iconColor || 'primary'" />
                </div>
                <div class="text-h3 text-weight-bold q-mb-xs" :class="stat.valueClass">
                  {{ stat.value }}
                  <q-tooltip v-if="stat.tooltip" class="bg-dark text-white">
                    {{ stat.tooltip }}
                  </q-tooltip>
                </div>
                <div class="text-subtitle1 text-grey-7">{{ stat.label }}</div>
              </div>
            </div>
          </q-carousel-slide>
        </q-carousel>
        
        <!-- Custom navigation dots -->
        <div class="carousel-navigation q-mt-md text-center">
          <q-btn
            v-for="(stat, index) in stats"
            :key="index"
            :class="['nav-dot', { active: currentSlide === index }]"
            size="xs"
            round
            flat
            @click="currentSlide = index"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface StatItem {
  value: string | number
  label: string
  icon?: string
  iconColor?: string
  valueClass?: string
  cardClass?: string
  cardStyle?: string | object
  colClass?: string
  tooltip?: string
}

interface Props {
  stats: StatItem[]
  isLoading?: boolean
}

withDefaults(defineProps<Props>(), {
  isLoading: false
})

const currentSlide = ref(0)
</script>

<style scoped>
.stats-container {
  width: 100%;
}

/* Glass card styling */
.glass-card {
  background: rgba(255, 255, 255, 0.25);
  border-radius: 16px;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.glass-stat-card {
  background: rgba(255, 255, 255, 0.4);
  border-radius: 12px;
  box-shadow: 0 2px 20px rgba(0, 0, 0, 0.08);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.4);
}

/* Desktop styles */
.stat-card {
  transition: transform 0.2s, box-shadow 0.2s;
  height: 100%;
  min-width: 180px;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.12);
}

/* Responsive font sizing for stat values */
@media (max-width: 1200px) {
  .stat-card .text-h4 {
    font-size: 1.5rem !important;
  }
}

@media (max-width: 992px) {
  .stat-card .text-h4 {
    font-size: 1.3rem !important;
  }
  .stat-card .text-subtitle2 {
    font-size: 0.8rem !important;
  }
}

@media (max-width: 768px) {
  .stat-card {
    min-width: 150px;
  }
  .stat-card .text-h4 {
    font-size: 1.2rem !important;
  }
  .stat-card .text-subtitle2 {
    font-size: 0.75rem !important;
  }
}

/* Mobile carousel styles */
.stats-carousel {
  background: transparent;
  border-radius: 12px;
}

.carousel-slide {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.mobile-stat-content {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

/* Navigation dots */
.carousel-navigation {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 16px;
}

.nav-dot {
  width: 10px;
  height: 10px;
  min-height: 10px;
  min-width: 10px;
  background: rgba(25, 118, 210, 0.3);
  transition: all 0.3s ease;
  border-radius: 50%;
  padding: 0;
}

.nav-dot.active {
  background: #1976d2;
  transform: scale(1.3);
  box-shadow: 0 0 8px rgba(25, 118, 210, 0.4);
}

.nav-dot:hover {
  background: #1976d2;
  opacity: 0.8;
  transform: scale(1.1);
}

/* Responsive visibility classes */
@media (max-width: 599px) {
  .hidden-xs-only {
    display: none !important;
  }
  
  .visible-xs-only {
    display: block !important;
  }
}

@media (min-width: 600px) {
  .visible-xs-only {
    display: none !important;
  }
  
  .hidden-xs-only {
    display: block !important;
  }
}

/* Touch-friendly swipe area */
.mobile-stats {
  touch-action: pan-x;
}

/* Remove default Quasar carousel styling */
.stats-carousel :deep(.q-carousel__slide) {
  padding: 0;
  background: transparent;
}

.stats-carousel :deep(.q-carousel__slides-container) {
  background: transparent;
}

.stats-carousel :deep(.q-carousel__control) {
  background: transparent;
}
</style>
