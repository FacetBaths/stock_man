<script setup lang="ts">
import { onMounted, ref, onUnmounted, computed } from "vue";
import { RouterView, useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import UserProfile from "@/components/UserProfile.vue";
import packageInfo from "../../package.json";
import { capitalizeWords } from "./utils/formatting";

const authStore = useAuthStore();
const router = useRouter();
const isDesktop = ref(window.innerWidth >= 768);
const showProfileDialog = ref(false);

const updateScreenSize = () => {
  isDesktop.value = window.innerWidth >= 768;
};

onMounted(async () => {
  await authStore.initializeAuth();

  // Redirect to dashboard if authenticated and on login page
  if (
    authStore.isAuthenticated &&
    router.currentRoute.value.path === "/login"
  ) {
    router.push("/dashboard");
  }

  window.addEventListener("resize", updateScreenSize);
  updateScreenSize();
});

onUnmounted(() => {
  window.removeEventListener("resize", updateScreenSize);
});

const handleLogout = async () => {
  console.log("=== HANDLELOGOUT CALLED FROM APP.VUE ===");
  console.log("Current route:", router.currentRoute.value.path);
  console.log("Auth store state before logout:", {
    isAuthenticated: authStore.isAuthenticated,
    user: authStore.user?.username,
  });

  try {
    console.log("Calling authStore.logout()...");
    await authStore.logout();
    console.log("authStore.logout() completed successfully");

    console.log("Pushing to /login route...");
    await router.push("/login");
    console.log("Router push completed");
  } catch (error) {
    console.error("Error in handleLogout:", error);
  }

  console.log("=== HANDLELOGOUT COMPLETED ===");
};

// Test API connectivity
const testApiConnection = async () => {
  console.log("=== TESTING API CONNECTION ===");
  console.log("API_BASE_URL from env:", import.meta.env.VITE_API_URL);

  try {
    // Test direct fetch to health endpoint
    console.log("Testing direct fetch to health endpoint...");
    const response = await fetch("http://localhost:5000/api/health");
    console.log("Health endpoint response status:", response.status);
    const data = await response.json();
    console.log("Health endpoint data:", data);

    // Test with axios api instance
    console.log("Testing with axios api instance...");
    const { healthApi } = await import("@/utils/api");
    const healthResponse = await healthApi.check();
    console.log("Axios health response:", healthResponse);
  } catch (error) {
    console.error("API connection test failed:", error);
  }

  console.log("=== API CONNECTION TEST COMPLETED ===");
};

// Force logout to clear stuck auth state
const forceLogout = () => {
  console.log("=== FORCE LOGOUT INITIATED ===");

  // Clear all auth data forcefully
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("token");
  localStorage.removeItem("user");

  // Clear auth store state if available
  if (authStore) {
    authStore.clearAuthData();
  }

  console.log("All auth data cleared, forcing page reload...");

  // Force page reload to reset the app state completely
  window.location.href = "/#/login";
  window.location.reload();

  console.log("=== FORCE LOGOUT COMPLETED ===");
};

const navTabs = computed(() => {
  const tabs = [
    { path: "/dashboard", label: "Dashboard", icon: "dashboard" },
    { path: "/tags", label: "Tag Management", icon: "local_offer" },
    { path: "/tools", label: "Tool Management", icon: "build" },
    { path: "/skus", label: "SKU Management", icon: "qr_code" },
  ];

  return tabs;
});

// Build info (can be injected during build process)
const buildInfo = {
  version: import.meta.env.VITE_APP_VERSION || packageInfo.version,
  buildTime: import.meta.env.VITE_BUILD_TIME || "Unknown",
  gitCommit: import.meta.env.VITE_GIT_COMMIT || "Unknown",
  gitBranch: import.meta.env.VITE_GIT_BRANCH || "Unknown",
  buildNumber: import.meta.env.VITE_BUILD_NUMBER || "Unknown",
};

const getVersionTooltip = () => {
  const buildDate =
    buildInfo.buildTime !== "Unknown"
      ? new Date(buildInfo.buildTime).toLocaleString()
      : buildInfo.buildTime;

  const buildNum =
    buildInfo.buildNumber !== "Unknown" && buildInfo.buildNumber.length > 6
      ? buildInfo.buildNumber.slice(-6)
      : buildInfo.buildNumber;

  return `Version: ${buildInfo.version}\nBuild: #${buildNum}\nCommit: ${buildInfo.gitCommit}\nBranch: ${buildInfo.gitBranch}\nBuilt: ${buildDate}`;
};
</script>

<template>
  <q-app>
    <q-layout v-if="authStore.isAuthenticated" view="hHh lpR fFf">
      <q-header class="glass-header">
        <q-toolbar class="q-px-lg" style="min-height: 70px;">
          <!-- Logo and Title -->
          <div class="row items-center no-wrap q-mr-lg">
            <q-btn flat href="/#"
              ><img
                src="@/assets/images/Logo_V2_Gradient7_CTC.png"
                alt="Facet Renovations Logo"
                class="nav-logo q-mr-md"
            /></q-btn>
            <div v-if="isDesktop" class="nav-title">
              <div class="row items-center q-gutter-xs">
                <div class="title text-h6 text-weight-bold q-mb-none">
                  Stock Manager
                </div>
                <q-chip
                  color="accent"
                  text-color="white"
                  size="sm"
                  class="version-chip"
                >
                  v{{ buildInfo.version }}
                  <q-tooltip class="bg-dark text-white" :delay="500">
                    {{ getVersionTooltip() }}
                  </q-tooltip>
                </q-chip>
              </div>
              <!-- <div class="text-caption text-white opacity-80">
                Facet Renovations
              </div> -->
            </div>
          </div>

          <!-- Desktop Navigation -->
          <div v-if="isDesktop" class="nav-tabs q-mx-xl">
            <router-link
              v-for="tab in navTabs"
              :key="tab.path"
              :to="tab.path"
              class="nav-tab"
              :class="{ 'nav-tab--active': $route.path === tab.path }"
            >
              <q-icon :name="tab.icon" class="q-mr-sm" />
              {{ tab.label }}
            </router-link>
          </div>

          <q-space />

          <!-- Temporary API Test Button (commented out for production) -->
          <!-- 
          <q-btn 
            flat 
            color="white"
            label="Test API"
            @click="testApiConnection"
            class="q-mr-md"
            size="sm"
          />
          -->

          <!-- Emergency Force Logout Button (commented out for production) -->
          <!-- 
          <q-btn 
            flat 
            color="red"
            label="Force Logout"
            @click="forceLogout"
            class="q-mr-md"
            size="sm"
            icon="logout"
          />
          -->

          <!-- Mobile Menu Button -->
          <q-btn
            v-if="!isDesktop"
            flat
            round
            class="mobile-menu-btn"
            icon="menu"
          >
            <q-menu class="glass-menu" anchor="bottom right" self="top right">
              <q-list class="q-pa-md" style="min-width: 220px;">
                <q-item
                  v-for="tab in navTabs"
                  :key="tab.path"
                  clickable
                  v-close-popup
                  :to="tab.path"
                  class="menu-item q-mb-sm"
                >
                  <q-item-section avatar>
                    <q-icon :name="tab.icon" class="text-primary" />
                  </q-item-section>
                  <q-item-section class="text-dark">{{
                    tab.label
                  }}</q-item-section>
                </q-item>
                <q-item
                  v-if="authStore.isAdmin"
                  clickable
                  v-close-popup
                  :to="'/users'"
                  class="menu-item q-mb-sm"
                >
                  <q-item-section avatar>
                    <q-icon name="people" class="text-primary" />
                  </q-item-section>
                  <q-item-section class="text-dark"
                    >User Management</q-item-section
                  >
                </q-item>
                <q-separator class="q-my-md" />
                <q-item
                  clickable
                  v-close-popup
                  @click="handleLogout"
                  class="menu-item logout-item"
                >
                  <q-item-section avatar>
                    <q-icon name="logout" class="text-negative" />
                  </q-item-section>
                  <q-item-section class="text-dark">Logout</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>

          <!-- Desktop User Menu -->
          <q-btn v-else flat class="user-menu-btn" no-caps>
            <q-avatar size="36px" class="q-mr-sm user-avatar">
              <q-icon
                name="account_circle"
                size="24px"
                class="text-secondary"
              />
            </q-avatar>
            <div class="user-info">
              <div class="text-black text-weight-medium">
                {{ capitalizeWords(authStore.user!.username) }}
              </div>
              <div class="text-caption text-grey opacity-70">
                {{ authStore.user?.role.replace("_", " ").toUpperCase() }}
              </div>
            </div>
            <q-icon name="expand_more" class="q-ml-sm text-white" />
            <q-menu class="glass-menu" anchor="bottom right" self="top right">
              <q-list class="q-pa-md" style="min-width: 200px;">
                <q-item-label header class="text-weight-bold text-dark">
                  {{ authStore.user?.role.replace("_", " ").toUpperCase() }}
                </q-item-label>
                <q-separator class="q-mb-md" />
                <q-item
                  clickable
                  v-close-popup
                  @click="showProfileDialog = true"
                  class="menu-item"
                >
                  <q-item-section avatar>
                    <q-icon name="account_circle" class="text-primary" />
                  </q-item-section>
                  <q-item-section class="text-dark">Profile</q-item-section>
                </q-item>
                <q-item
                  v-if="authStore.isAdmin"
                  clickable
                  v-close-popup
                  :to="'/users'"
                  class="menu-item"
                >
                  <q-item-section avatar>
                    <q-icon name="people" class="text-primary" />
                  </q-item-section>
                  <q-item-section class="text-dark"
                    >User Management</q-item-section
                  >
                </q-item>
                <q-separator v-if="authStore.isAdmin" class="q-my-sm" />
                <q-item
                  clickable
                  v-close-popup
                  @click="handleLogout"
                  class="menu-item logout-item"
                >
                  <q-item-section avatar>
                    <q-icon name="logout" class="text-negative" />
                  </q-item-section>
                  <q-item-section class="text-dark">Logout</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </q-toolbar>
        <q-toolbar inset v-if="!isDesktop">
          <div class="title text-h6 text-weight-bold q-mb-none">
            Stock Manager
          </div>
          <q-chip
            color="accent"
            text-color="white"
            size="sm"
            class="version-chip"
          >
            v{{ buildInfo.version }}
            <q-tooltip class="bg-dark text-white" :delay="500">
              {{ getVersionTooltip() }}
            </q-tooltip>
          </q-chip>
        </q-toolbar>
      </q-header>

      <q-page-container class="gradient-bg">
        <RouterView />
      </q-page-container>
    </q-layout>

    <!-- Login page without layout -->
    <div v-else>
      <RouterView />
    </div>

    <!-- Profile Dialog -->
    <q-dialog v-model="showProfileDialog" maximized>
      <q-card class="full-width full-height">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">User Profile</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section class="q-pt-none full-height">
          <UserProfile />
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-app>
</template>

<style lang="css">
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: "Tomorrow", -apple-system, BlinkMacSystemFont, "Segoe UI",
    "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans",
    "Helvetica Neue", sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background-color: #f5f5f5;
  font-size: 14px;
  line-height: 1.5;
}

#app {
  min-height: 100vh;
}

.title {
  color: #6c757d;
}

/* Basic button styles */
.btn {
  display: inline-block;
  padding: 0.5rem 1rem;
  margin: 0.25rem;
  font-size: 1rem;
  font-weight: 500;
  line-height: 1.5;
  text-align: center;
  text-decoration: none;
  border: 1px solid transparent;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.15s ease-in-out;
}

.btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.btn-primary {
  color: #fff;
  background-color: #007bff;
  border-color: #007bff;
}

.btn-primary:hover:not(:disabled) {
  background-color: #0056b3;
  border-color: #004085;
}

.btn-secondary {
  color: #fff;
  background-color: #6c757d;
  border-color: #6c757d;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #545b62;
  border-color: #4e555b;
}

.btn-danger {
  color: #fff;
  background-color: #dc3545;
  border-color: #dc3545;
}

.btn-danger:hover:not(:disabled) {
  background-color: #c82333;
  border-color: #bd2130;
}

.btn-success {
  color: #fff;
  background-color: #28a745;
  border-color: #28a745;
}

.btn-success:hover:not(:disabled) {
  background-color: #218838;
  border-color: #1e7e34;
}

/* Form styles */
.form-group {
  margin-bottom: 1rem;
}

.form-label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.form-control {
  display: block;
  width: 100%;
  padding: 0.5rem 0.75rem;
  font-size: 1rem;
  line-height: 1.5;
  color: #495057;
  background-color: #fff;
  border: 1px solid #ced4da;
  border-radius: 0.375rem;
  transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
}

.form-control:focus {
  color: #495057;
  background-color: #fff;
  border-color: #80bdff;
  outline: 0;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
}

.form-select {
  display: block;
  width: 100%;
  padding: 0.5rem 2.25rem 0.5rem 0.75rem;
  font-size: 1rem;
  line-height: 1.5;
  color: #495057;
  background-color: #fff;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath fill='none' stroke='%23343a40' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m1 6 7 7 7-7'/%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  background-size: 16px 12px;
  border: 1px solid #ced4da;
  border-radius: 0.375rem;
  appearance: none;
}

.form-select:focus {
  border-color: #80bdff;
  outline: 0;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
}

/* Alert styles */
.alert {
  position: relative;
  padding: 0.75rem 1.25rem;
  margin-bottom: 1rem;
  border: 1px solid transparent;
  border-radius: 0.375rem;
}

.alert-danger {
  color: #721c24;
  background-color: #f8d7da;
  border-color: #f5c6cb;
}

.alert-success {
  color: #155724;
  background-color: #d4edda;
  border-color: #c3e6cb;
}

.alert-info {
  color: #0c5460;
  background-color: #d1ecf1;
  border-color: #bee5eb;
}

/* Card styles */
.card {
  position: relative;
  display: flex;
  flex-direction: column;
  background-color: #fff;
  border: 1px solid #dee2e6;
  border-radius: 0.375rem;
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
}

.card-header {
  padding: 0.75rem 1.25rem;
  margin-bottom: 0;
  background-color: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
  border-radius: 0.375rem 0.375rem 0 0;
}

.card-body {
  flex: 1 1 auto;
  padding: 1.25rem;
}

/* Loading spinner */
.spinner {
  display: inline-block;
  width: 1rem;
  height: 1rem;
  border: 2px solid #f3f3f3;
  border-top: 2px solid #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* Utility classes */
.text-center {
  text-align: center;
}
.text-right {
  text-align: right;
}
.text-left {
  text-align: left;
}
.mt-2 {
  margin-top: 0.5rem;
}
.mt-3 {
  margin-top: 1rem;
}
.mb-2 {
  margin-bottom: 0.5rem;
}
.mb-3 {
  margin-bottom: 1rem;
}
.ml-2 {
  margin-left: 0.5rem;
}
.mr-2 {
  margin-right: 0.5rem;
}
.p-2 {
  padding: 0.5rem;
}
.p-3 {
  padding: 1rem;
}
.d-flex {
  display: flex;
}
.align-items-center {
  align-items: center;
}
.justify-content-between {
  justify-content: space-between;
}
.justify-content-center {
  justify-content: center;
}
.flex-wrap {
  flex-wrap: wrap;
}
.gap-2 {
  gap: 0.5rem;
}
.gap-3 {
  gap: 1rem;
}

/* Gradient background similar to landing page */
.gradient-bg {
  min-height: 100vh;
  background: linear-gradient(135deg, #9945ff, #ffffff, #14f195);
  background-size: 400% 400%;
  animation: gradientAnimation 15s ease infinite;
}

@keyframes gradientAnimation {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

/* Header styling */
.header {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

/* Glassmorphism card effect */
.glass-card {
  background: rgba(255, 255, 255, 0.25);
  border-radius: 16px;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

/* Dark glass card for contrast */
.glass-card-dark {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 16px;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* Navigation Header Styling */
.glass-header {
  background: rgba(255, 255, 255, 0.25) !important;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
}

.nav-logo {
  height: 40px;
  width: auto;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
  transition: all 0.3s ease;
}

.nav-logo:hover {
  transform: scale(1.05);
}

.nav-title {
  line-height: 1.2;
}

.nav-tabs {
  display: flex;
  gap: 8px;
}

.nav-tab {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  border-radius: 12px;
  color: rgba(0, 0, 0, 0.8);
  text-decoration: none;
  font-weight: 500;
  font-size: 14px;
  transition: all 0.3s ease;
  background: rgba(255, 255, 255, 0.1);
  /* border: 1px solid rgba(255, 255, 255, 0.2); */
}

.nav-tab:hover {
  color: white;
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.nav-tab--active {
  color: white !important;
  background: rgba(0, 0, 0, 0.5) !important;
  border-color: rgba(255, 255, 255, 0.4);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.mobile-menu-btn {
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  transition: all 0.3s ease;
}

.mobile-menu-btn:hover {
  background: rgba(255, 255, 255, 0.25);
}

.user-menu-btn {
  background: rgba(255, 255, 255, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  padding: 8px 16px;
  transition: all 0.3s ease;
}

.user-menu-btn:hover {
  background: rgba(255, 255, 255, 1);
  transform: translateY(-1px);
}

.user-avatar {
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.user-info {
  text-align: left;
  line-height: 1.2;
}

.glass-menu {
  background: rgba(255, 255, 255, 0.95) !important;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 12px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.menu-item {
  border-radius: 8px;
  margin-bottom: 4px;
  transition: all 0.2s ease;
}

.menu-item:hover {
  background: rgba(103, 126, 234, 0.1);
}

.logout-item:hover {
  background: rgba(244, 67, 54, 0.1);
}

/* Opacity utilities */
.opacity-70 {
  opacity: 0.7;
}

.opacity-80 {
  opacity: 0.8;
}

/* Version chip styling */
.version-chip {
  border: 1px solid rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(10px);
  font-weight: 500;
  font-size: 11px;
  transition: all 0.3s ease;
}

.version-chip:hover {
  background: rgba(255, 255, 255, 0.3) !important;
  transform: scale(1.05);
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .nav-logo {
    height: 32px;
  }

  .glass-header .q-toolbar {
    min-height: 60px;
    padding-left: 16px;
    padding-right: 16px;
  }

  .version-chip {
    font-size: 10px;
  }
}
</style>
