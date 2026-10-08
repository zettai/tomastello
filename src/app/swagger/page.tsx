"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";
import "./swagger-light-theme.css";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Define interfaces
interface User {
  id: string;
  email: string;
  createdAt: string;
  lastLogin?: string;
}

interface SwaggerSpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers: Array<{
    url: string;
    description?: string;
  }>;
  paths: Record<string, unknown>;
  components?: Record<string, unknown>;
}

// Dynamically import SwaggerUI with no SSR to avoid hydration issues
const SwaggerUI = dynamic(() => import("swagger-ui-react"), {
  ssr: false,
  loading: () => (
    <div className="flex justify-center items-center py-8">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
      <span className="ml-3 text-gray-600 dark:text-gray-400">
        Loading Swagger UI...
      </span>
    </div>
  ),
});

export default function SwaggerPage() {
  const [spec, setSpec] = useState<SwaggerSpec | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const router = useRouter();

  // Authentication check
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const response = await fetch("/api/auth/profile");
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        } else {
          router.push("/login?redirect=/swagger");
        }
      } catch (error) {
        console.error("Failed to fetch user profile:", error);
        router.push("/login?redirect=/swagger");
      } finally {
        setAuthLoading(false);
      }
    };

    fetchUserProfile();
  }, [router]);

  // Swagger spec loading
  useEffect(() => {
    if (!user) return; // Don't load swagger spec until user is authenticated

    // Suppress the specific React strict mode warning for swagger-ui-react
    const originalConsoleWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      if (
        typeof args[0] === "string" &&
        args[0].includes("UNSAFE_componentWillReceiveProps")
      ) {
        return; // Suppress this specific warning
      }
      originalConsoleWarn.apply(console, args);
    };

    fetch("/api/swagger")
      .then((response) => response.json())
      .then((data: SwaggerSpec) => {
        setSpec(data);
        setLoading(false);
      })
      .catch((err) => {
        setError("Failed to load API specification");
        setLoading(false);
        console.error("Error loading swagger spec:", err);
      });

    // Cleanup: restore original console.warn when component unmounts
    return () => {
      console.warn = originalConsoleWarn;
    };
  }, [user]); // Depend on user so it loads after authentication

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen p-8 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-gray-600 dark:text-gray-400">
              Checking authentication...
            </span>
          </div>
        </div>
      </div>
    );
  }

  // If not authenticated, this will redirect, but show a message just in case
  if (!user) {
    return (
      <div className="min-h-screen p-8 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="text-gray-600 dark:text-gray-400 text-lg mb-4">
              Redirecting to login...
            </div>
            <Link
              href="/login"
              className="text-blue-500 hover:text-blue-600 underline"
            >
              Click here if not redirected automatically
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen p-8 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-gray-600 dark:text-gray-400">
              Loading API Documentation...
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen p-8 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="text-red-500 text-lg mb-4">{error}</div>
            <Link
              href="/"
              className="text-blue-500 hover:text-blue-600 underline"
            >
              Return to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                API Documentation
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Interactive API documentation and testing interface
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                Logged in as: {user.email}
              </p>
            </div>
            <div className="flex space-x-4 items-center">
              <Link
                href="/"
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                ← Home
              </Link>
              <Link
                href="/admin"
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
              >
                Admin Panel
              </Link>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Swagger UI */}
      <div className="max-w-7xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {spec && (
            <div suppressHydrationWarning className="swagger-light-theme">
              <SwaggerUI
                spec={spec}
                docExpansion="list"
                defaultModelExpandDepth={1}
                defaultModelsExpandDepth={1}
                displayOperationId={false}
                displayRequestDuration={true}
                supportedSubmitMethods={[
                  "get",
                  "post",
                  "put",
                  "delete",
                  "patch",
                ]}
                tryItOutEnabled={true}
                requestInterceptor={(request) => {
                  // Add any custom request interceptors here
                  return request;
                }}
                responseInterceptor={(response) => {
                  // Add any custom response interceptors here
                  return response;
                }}
              />
            </div>
          )}
        </div>

        {/* Additional Information */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
              🔐 Authentication
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Most endpoints require authentication. Sign in at /login with an
              admin magic link; the session cookie is set when you open the link.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
              📊 Metadata System
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              All uploaded images automatically get metadata stored including
              descriptions, tags, and uploader information.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
              💾 Cost-Effective Storage
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Uses Scaleway Object Storage with JSON files for metadata and user
              data - virtually $0 additional cost.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
