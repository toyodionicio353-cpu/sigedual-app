import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // firebase-admin usa dependencias con requires dinámicos (grpc,
  // google-auth-library) que el empaquetador de Next rompe si intenta
  // incluirlas en el bundle. Se dejan como paquete externo para que se
  // carguen tal cual en el entorno de Node de la función serverless.
  serverExternalPackages: ["firebase-admin"],
};

export default nextConfig;
