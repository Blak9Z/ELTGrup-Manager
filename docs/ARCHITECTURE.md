# Architecture Documentation

This document describes the high-level architecture of ELTGRUP Manager.

## Overview

ELTGRUP Manager is a construction management platform built with Next.js 16 (App Router), React 19, TypeScript, and Prisma ORM with PostgreSQL.

## Core Pillars

### 1. Multi-Layer Security & Access Control

The application implements a robust, multi-layered security model:

-   **Authentication**: Handled by NextAuth using the Credentials provider.
-   **RBAC (Role-Based Access Control)**: Defined in `src/lib/rbac.ts`. Roles like `SUPER_ADMIN`, `PROJECT_MANAGER`, `WORKER`, etc., have specific granular permissions (`VIEW`, `CREATE`, `UPDATE`, `DELETE`, `APPROVE`, `EXPORT`, `MANAGE`) for various resources.
-   **Dynamic Access Scoping**: Implemented in `src/lib/access-scope.ts`. This ensures that even if a user has "VIEW" permission for "PROJECTS", they only see the specific projects they are assigned to (as a manager, worker, client, or subcontractor).
-   **Server-Side Verification**: Every Server Action and API route performs triple checks: `session check` -> `permission check` -> `scope check`.

### 2. Operational Audit Trail

Every sensitive data mutation is recorded in the `ActivityLog` table. This provides a clear history of who changed what, when, and from where (IP/User Agent). The `diff` field stores JSON data representing the changes.

### 3. Modular Directory Structure

-   `app/(app)`: Contains all operational routes grouped together. Each module (e.g., `proiecte`, `lucrari`) has its own page and Server Actions.
-   `src/components`: UI components organized by category (`ui`, `layout`, `auth`, `forms`).
-   `src/lib`: Core logic including database client, authentication, RBAC, scoping, and shared utilities.
-   `src/modules`: Complex, feature-specific components (e.g., dashboard charts).

## Performance Optimizations

Recently implemented optimizations include:

-   **Parallel Query Execution**: Critical pages (like the Dashboard) and core functions (like `resolveAccessScope`) use `Promise.all` to fetch data concurrently, significantly reducing TTFB.
-   **Request-Level Caching**: The `resolveAccessScope` function uses React's `cache()` to avoid redundant database calls within a single render cycle.
-   **Database Indexing**: Advanced GIN indexes for array/JSON fields and composite indexes for common filtering patterns (status, project ID, dates).
-   **Bundle Optimization**: Heavy client-side components use `next/dynamic` for code splitting.

## Technology Stack

-   **Framework**: Next.js 16 (App Router / Turbopack)
-   **Frontend**: React 19, Tailwind CSS 4, HeroUI (NextUI)
-   **Database**: PostgreSQL + Prisma ORM
-   **Validation**: Zod
-   **Export**: `pdf-lib` for PDFs, built-in CSV generators
-   **Infrastructure**: Vercel (Frontend/API), AWS S3 or Local (Storage)
