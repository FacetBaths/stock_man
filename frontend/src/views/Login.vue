<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useQuasar } from "quasar";

const router = useRouter();
const authStore = useAuthStore();
const $q = useQuasar();

const credentials = ref({
  username: "admin", // Default to admin
  password: "",
});

const userOptions = [
  { label: "Admin", value: "admin" },
  { label: "Warehouse Manager", value: "warehouse" },
];

const handleLogin = async () => {
  console.log(credentials.value);
  try {
    await authStore.login(credentials.value);
    $q.notify({
      type: "positive",
      message: "Login successful!",
      position: "top",
    });
    router.push("/dashboard");
  } catch (error) {
    // Error is handled by the store
  }
};

const quickLoginAsSales = async () => {
  try {
    await authStore.login({ username: "sales", password: "FacetSales!" });
    $q.notify({
      type: "positive",
      message: "Logged in as Sales!",
      position: "top",
    });
    router.push("/dashboard");
  } catch (error) {
    // Error is handled by the store
  }
};
</script>

<template>
  <div class="login-page">
    <div class="login-container">
      <!-- Logo Section -->

      <!-- Login Card -->
      <div class="login-card">
        <div class="logo-section center q-mb-lg">
          <img
            src="@/assets/images/Logo_V2_Gradient7_CTC.png"
            alt="Facet Renovations Logo"
            class="logo"
          />
        </div>
        <div class="login-card-header">
          <h1 class="title">Stock Manager</h1>
          <p class="subtitle">Facet Renovations Inventory System</p>
        </div>

        <!-- Error Message -->
        <div v-if="authStore.error" class="error-banner">
          {{ authStore.error }}
        </div>

        <!-- Login Form -->
        <form @submit.prevent="handleLogin" class="login-form">
          <!-- Username Select -->
          <div class="input-group">
            <label for="username" class="input-label">Select User Type</label>
            <q-select
              v-model="credentials.username"
              :options="userOptions"
              option-label="label"
              option-value="value"
              emit-value
              map-options
              class="login-select"
              filled
              color="primary"
            >
              <template v-slot:prepend>
                <q-icon name="contact" color="primary" />
              </template>
            </q-select>
          </div>

          <!-- Password Input -->
          <div class="input-group">
            <label for="password" class="input-label">Password</label>
            <div class="input-wrapper">
              <q-icon name="lock" class="input-icon" />
              <input
                id="password"
                v-model="credentials.password"
                type="password"
                class="login-input"
                placeholder="Enter your password"
                required
              />
            </div>
          </div>

          <!-- Login Button -->
          <q-btn
            type="submit"
            flat
            text-color="primary"
            size="lg"
            class="full-width q-mt-lg login-btn"
            :loading="authStore.isLoading"
            :disable="authStore.isLoading"
            unelevated
            icon="login"
            :label="authStore.isLoading ? 'Signing in...' : 'Sign In'"
          />

          <!-- Quick Login Button -->
          <q-btn
            type="button"
            @click="quickLoginAsSales"
            color="teal"
            size="md"
            class="full-width q-mt-sm quick-login-btn"
            :loading="authStore.isLoading"
            :disable="authStore.isLoading"
            outline
            no-caps
            icon="flash_on"
            label="Quick Login as Sales"
          />
        </form>

        <!-- Demo Credentials -->
        <!-- <div class="demo-section">
          <h3 class="demo-title">Demo Credentials:</h3>
          <div class="demo-creds">
            <p><strong>Admin:</strong> admin / admin123</p>
            <p><strong>Warehouse:</strong> warehouse / warehouse456</p>
            <p><strong>Sales:</strong> sales / any password</p>
          </div>
        </div> -->
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Main login page */
.login-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #9945ff, #ffffff, #14f195);
  background-size: 400% 400%;
  animation: gradientAnimation 15s ease infinite;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
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

.login-container {
  width: 100%;
  max-width: 450px;
}

/* Logo section */
.logo-section {
  text-align: center;
  margin-bottom: 1.5rem;
}

.logo {
  height: 80px;
  width: auto;
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3));
  transition: transform 0.3s ease;
}

.logo:hover {
  transform: scale(1.05);
}

/* Login card with glassmorphism */
.login-card {
  background: rgba(255, 255, 255, 0.15) !important;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  padding: 2rem;
}

.login-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
  background: rgba(255, 255, 255, 0.2) !important;
}

/* Card header */
.login-card-header {
  text-align: center;
  margin-bottom: 2rem;
}

.title {
  color: rgb(0, 0, 0);
  font-size: 2rem;
  font-weight: bold;
  margin: 0 0 0.5rem 0;
  font-family: "Tomorrow", sans-serif;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.subtitle {
  color: rgba(0, 0, 0, 0.9);
  font-size: 1rem;
  margin: 0;
  font-family: "Tomorrow", sans-serif;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

/* Error banner */
.error-banner {
  background: rgba(244, 67, 54, 0.9);
  color: white;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  text-align: center;
  font-family: "Tomorrow", sans-serif;
}

/* Login form */
.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Input groups */
.input-group {
  display: flex;
  flex-direction: column;
}

.input-label {
  color: rgba(0, 0, 0, 0.9);
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  font-family: "Tomorrow", sans-serif;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 1rem;
  color: #9945ff;
  z-index: 1;
}

.login-input {
  width: 100%;
  padding: 1rem 1rem 1rem 3rem;
  background: rgba(255, 255, 255, 0.3);
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  color: #333;
  font-size: 1rem;
  font-family: "Tomorrow", sans-serif;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  transition: all 0.3s ease;
}

.login-input::placeholder {
  color: rgba(0, 0, 0, 0.5);
}

.login-input:focus {
  outline: none;
  background: rgba(255, 255, 255, 0.95);
  border-color: #9945ff;
  box-shadow: 0 0 0 2px rgba(153, 69, 255, 0.2);
}

/* Demo credentials section */
.demo-section {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  text-align: center;
}

.demo-title {
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.875rem;
  font-weight: 600;
  margin: 0 0 1rem 0;
  font-family: "Tomorrow", sans-serif;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.demo-creds {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.demo-creds p {
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.75rem;
  margin: 0;
  font-family: "Tomorrow", sans-serif;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

/* Input styling */
.login-input :deep(.q-field__control) {
  background: rgba(255, 255, 255, 0.8) !important;
  border-radius: 12px !important;
  border: 1px solid rgba(0, 0, 0, 0.1) !important;
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
}

/* Select dropdown styling */
.login-select :deep(.q-field__control) {
  background: rgba(255, 255, 255, 0.8) !important;
  border-radius: 12px !important;
  border: 1px solid rgba(0, 0, 0, 0.1) !important;
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
  min-height: 56px;
}

.login-select :deep(.q-field__control):hover {
  background: rgba(255, 255, 255, 0.9) !important;
  border-color: rgba(0, 0, 0, 0.2) !important;
}

.login-select :deep(.q-field--focused .q-field__control) {
  background: rgba(255, 255, 255, 0.95) !important;
  border-color: var(--q-primary) !important;
  box-shadow: 0 0 0 2px rgba(153, 69, 255, 0.2) !important;
}

.login-select :deep(.q-field__native) {
  color: #333 !important;
  font-family: "Tomorrow", sans-serif !important;
  font-weight: 500;
}

.login-select :deep(.q-field__label) {
  color: rgba(0, 0, 0, 0.7) !important;
  font-family: "Tomorrow", sans-serif !important;
  font-weight: 500;
}

.login-select :deep(.q-field__input) {
  color: #333 !important;
  font-family: "Tomorrow", sans-serif !important;
  font-weight: 500;
}

.login-select :deep(.q-icon) {
  color: #9945ff !important;
}

.login-input :deep(.q-field__control):hover {
  background: rgba(255, 255, 255, 0.9) !important;
  border-color: rgba(0, 0, 0, 0.2) !important;
}

.login-input :deep(.q-field--focused .q-field__control) {
  background: rgba(255, 255, 255, 0.95) !important;
  border-color: var(--q-primary) !important;
  box-shadow: 0 0 0 2px rgba(153, 69, 255, 0.2) !important;
}

.login-input :deep(.q-field__native) {
  color: #333 !important;
  font-family: "Tomorrow", sans-serif !important;
  font-weight: 500;
}

.login-input :deep(.q-field__label) {
  color: rgba(0, 0, 0, 0.7) !important;
  font-family: "Tomorrow", sans-serif !important;
  font-weight: 500;
}

/* Button styling */
.login-btn {
  border-radius: 12px;
  background: rgba(153, 69, 255, 0.8) !important;
  font-weight: 600;
  font-family: "Tomorrow", sans-serif;
  letter-spacing: 0.5px;
  transition: all 0.3s ease;
}

.login-btn :deep(.q-btn__content) {
  color: white !important;
}

.login-btn :deep(.q-icon) {
  color: white !important;
}

.login-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(153, 69, 255, 0.4);
}

.quick-login-btn {
  border-radius: 12px;
  font-weight: 500;
  font-family: "Tomorrow", sans-serif;
  letter-spacing: 0.3px;
  transition: all 0.3s ease;
}

.quick-login-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(38, 166, 154, 0.2);
}

/* Demo credentials */
.demo-list {
  background: transparent;
}

.demo-item {
  padding: 0.25rem 0;
}

.demo-item :deep(.q-item__section) {
  padding: 0;
}

/* Responsive design */
@media (max-width: 600px) {
  .login-page {
    padding: 0.5rem;
  }

  .login-container {
    max-width: 100%;
  }

  .logo {
    height: 60px;
  }

  .login-card {
    border-radius: 16px;
  }

  .login-input :deep(.q-field__control) {
    border-radius: 10px !important;
  }

  .login-btn,
  .quick-login-btn {
    border-radius: 10px;
  }
}

/* AOS animations enhancement */
[data-aos] {
  pointer-events: none;
}

[data-aos].aos-animate {
  pointer-events: auto;
}
</style>
