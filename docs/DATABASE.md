# Database Documentation

ELTGRUP Manager uses PostgreSQL as its primary database, managed through Prisma ORM.

## Schema Overview

The schema is divided into several main entity groups:

### 1. User & Access Control
-   `User`: Base user profile.
-   `Role`: System roles (SUPER_ADMIN, etc.).
-   `Permission`: Resource/Action pairs.
-   `UserRole`, `RolePermission`: Join tables for RBAC.
-   `WorkerProfile`: Extended data for workers (hourly rate, team alocation).

### 2. Core Business Entities
-   `Client`: Client company/individual data.
-   `Project`: The top-level container for all construction work.
-   `ProjectPhase`: Milestone-based grouping within a project.
-   `WorkOrder`: Individual tasks or jobs.
-   `TaskChecklistItem`: Granular steps within a work order.

### 3. Execution & Reporting
-   `TimeEntry`: Employee time tracking (punched in/out).
-   `Attendance`: Daily attendance logs with GPS coordinates.
-   `DailySiteReport`: Progress reports from the field, including weather and blockers.
-   `ActivityLog`: Audit trail of system changes.
-   `Comment`: Communication on specific work orders.

### 4. Logistics & Financial
-   `Material`: Catalog of available materials.
-   `Warehouse`: Storage locations.
-   `StockMovement`: Log of material IN/OUT/TRANSFER operations.
-   `MaterialRequest`: Requests from the field for specific materials.
-   `Equipment`: Physical assets (tools, vehicles).
-   `EquipmentAssignment`: Tracking who is using what tool on which project.
-   `InventoryItem`: Trackable assets with serial numbers.
-   `Invoice`: Financial billing documents associated with projects.
-   `CostEntry`: Manual recording of project-related costs.

## Performance & Indexing

The database has been optimized for high performance with the following index strategies:

### Composite Indexes
Common filtering patterns are indexed to ensure fast query response times:
-   `WorkOrder`: `[projectId, status, dueDate]`
-   `DailySiteReport`: `[projectId, workOrderId, reportDate]`
-   `Project`: `[clientId, status]`

### Advanced GIN Indexes
PostgreSQL GIN (Generalized Inverted Index) is used for:
-   **Arrays**: `Document.tags`, `DailySiteReport.photos`, `WorkOrder.dependencyIds`, `Comment.mentions`.
-   **JSONB**: `ActivityLog.diff` (allows efficient searching within the audit trail).

## Maintenance

### Updating the Schema
1.  Modify `prisma/schema.prisma`.
2.  Run `npm run db:generate` to update the Prisma Client.
3.  Run `npm run db:migrate -- --name your_migration_name` to create and apply a migration.

### Deployment Migrations
In production environments, always use:
```bash
npx prisma migrate deploy
```
This applies pending migrations without prompting for data-loss confirmation or trying to seed the database.
