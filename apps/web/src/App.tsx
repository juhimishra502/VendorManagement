import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "./lib/auth.js";
import { ToastProvider } from "./components/Toast.js";
import { router } from "./router.js";

export function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ToastProvider>
  );
}
