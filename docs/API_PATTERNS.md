# API Patterns & Best Practices

This document outlines API patterns, best practices, and common pitfalls to avoid when developing with the Xmrit Hub codebase.

## Table of Contents

1. [Data Fetching Patterns](#data-fetching-patterns)
2. [API Response Handling](#api-response-handling)
3. [Shared Hooks & Utilities](#shared-hooks--utilities)
4. [TypeScript Best Practices](#typescript-best-practices)
5. [Common Pitfalls](#common-pitfalls)
6. [Code Review Checklist](#code-review-checklist)

## Data Fetching Patterns

### Using Centralized API Clients

**✅ GOOD - Use centralized API client:**

```typescript
import { useUsers } from "@/lib/api/users";

function MyComponent() {
  const { data: users = [], isLoading } = useUsers();
  // users is correctly typed as User[]
}
```

**❌ BAD - Manual fetch without proper type safety:**

```typescript
function MyComponent() {
  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const response = await fetch("/api/users");
      return response.json(); // ❌ Returns { users: [...] }, not [...]
    },
  });
}
```

### API Response Structure Pattern

All API responses should follow a consistent structure. When fetching data, always extract the correct field from the response.

**Standard Response Patterns:**

```typescript
// Collection endpoint returns { items: [...] }
GET /api/users → { users: User[] }
GET /api/slides → { slides: Slide[] }

// Single item endpoint returns { item: {...} }
GET /api/users/:id → { user: User }
GET /api/slides/:id → { slide: Slide }
```

**Correct Extraction:**

```typescript
// ✅ GOOD - Extract the nested data
const { data: usersData } = useQuery({
  queryKey: ["users"],
  queryFn: async () => {
    const response = await fetch("/api/users");
    const data = await response.json();
    return data.users; // Extract the users array
  },
});
```

## API Response Handling

### Rule: Always Extract Response Data

**The Problem:**

Many of our API endpoints return data wrapped in an object:

```json
{
  "users": [{ "id": "1", "name": "Alice" }],
  "count": 1
}
```

If you return `response.json()` directly, you get the wrapper object, not the array. This causes TypeScript mismatches and runtime errors.

**The Solution:**

Always extract the specific field:

```typescript
// ✅ CORRECT
queryFn: async () => {
  const response = await fetch("/api/users");
  if (!response.ok) throw new Error("Failed to fetch users");
  const data = await response.json();
  return data.users; // Extract the array
}

// ❌ WRONG
queryFn: async () => {
  const response = await fetch("/api/users");
  if (!response.ok) throw new Error("Failed to fetch users");
  return response.json(); // Returns { users: [...] } instead of [...]
}
```

### Type Safety Pattern

Use TypeScript generics to ensure type safety:

```typescript
const { data: usersData } = useQuery<User[]>({
  queryKey: ["users"],
  queryFn: async (): Promise<User[]> => {
    const response = await fetch("/api/users");
    if (!response.ok) throw new Error("Failed to fetch");
    const data: { users: User[] } = await response.json();
    return data.users;
  },
});
```

## Shared Hooks & Utilities

### Centralized Hooks Location

All shared React Query hooks should be in:

```
src/lib/api/
  ├── base.ts           # Base API client class
  ├── users.ts          # User hooks (useUsers, etc.)
  ├── workspaces.ts     # Workspace hooks
  ├── slides.ts         # Slide hooks
  ├── follow-ups.ts     # Follow-up hooks
  └── index.ts          # Central export point
```

### Creating New API Hooks

When creating a new API hook, follow this pattern:

```typescript
// src/lib/api/example.ts
import { useQuery } from "@tanstack/react-query";
import type { Example } from "@/types/db/example";
import { BaseApiClient } from "./base";

export class ExampleApiClient extends BaseApiClient {
  async getAllExamples(): Promise<Example[]> {
    const response = await this.get<{ examples: Example[] }>("/examples");
    return response.examples; // Extract the array
  }
}

export const exampleApiClient = new ExampleApiClient();

export const exampleKeys = {
  all: ["examples"] as const,
  list: () => [...exampleKeys.all, "list"] as const,
};

export function useExamples() {
  return useQuery({
    queryKey: exampleKeys.list(),
    queryFn: () => exampleApiClient.getAllExamples(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes cache
  });
}
```

### Using Shared Hooks

**✅ GOOD - Use the shared hook:**

```typescript
import { useUsers } from "@/lib/api";

function MyComponent() {
  const { data: users = [], isLoading } = useUsers();
  // ✅ Type-safe, centralized, cached properly
}
```

**❌ BAD - Duplicate the query logic:**

```typescript
function MyComponent() {
  // ❌ Duplicates logic, misses response extraction
  const { data } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const response = await fetch("/api/users");
      return response.json();
    },
  });
}
```

## TypeScript Best Practices

### API Response Types

Define clear TypeScript interfaces for API responses:

```typescript
// ✅ GOOD - Clear response types
interface UsersResponse {
  users: User[];
  count: number;
}

interface UserResponse {
  user: User;
}

// In API client
async getAllUsers(): Promise<User[]> {
  const response = await this.get<UsersResponse>("/users");
  return response.users;
}

async getUserById(id: string): Promise<User> {
  const response = await this.get<UserResponse>(`/users/${id}`);
  return response.user;
}
```

### Type Guards

Use type guards for runtime validation:

```typescript
function isUsersResponse(data: unknown): data is UsersResponse {
  return (
    typeof data === "object" &&
    data !== null &&
    "users" in data &&
    Array.isArray((data as UsersResponse).users)
  );
}

// Usage
const data = await response.json();
if (!isUsersResponse(data)) {
  throw new Error("Invalid response structure");
}
return data.users;
```

## Common Pitfalls

### 1. Forgetting to Extract Response Data

**Issue:** Returning the full API response instead of the data field.

**❌ Wrong:**
```typescript
const { data: users } = useQuery({
  queryFn: async () => {
    const response = await fetch("/api/users");
    return response.json(); // Returns { users: [...] }
  },
});
// users is { users: [...] }, not [...]
```

**✅ Correct:**
```typescript
const { data: users } = useQuery({
  queryFn: async () => {
    const response = await fetch("/api/users");
    const data = await response.json();
    return data.users; // Returns [...]
  },
});
```

### 2. Inconsistent Query Keys

**Issue:** Using different query keys for the same data leads to cache misses.

**❌ Wrong:**
```typescript
// In component A
const { data } = useQuery({ queryKey: ["users"] });

// In component B
const { data } = useQuery({ queryKey: ["all-users"] });
// ❌ Same data, different cache
```

**✅ Correct:**
```typescript
// Use centralized query key factory
export const userKeys = {
  all: ["users"] as const,
  list: () => [...userKeys.all, "list"] as const,
  detail: (id: string) => [...userKeys.all, "detail", id] as const,
};

// Both components use the same key
const { data } = useQuery({ queryKey: userKeys.list() });
```

### 3. Missing Error Handling

**❌ Wrong:**
```typescript
queryFn: async () => {
  const response = await fetch("/api/users");
  return response.json();
  // ❌ Doesn't check response.ok
}
```

**✅ Correct:**
```typescript
queryFn: async () => {
  const response = await fetch("/api/users");
  if (!response.ok) {
    throw new Error(`Failed to fetch users: ${response.statusText}`);
  }
  const data = await response.json();
  return data.users;
}
```

### 4. Redundant sortOrder Fields

**Issue:** Using both `sortOrder` and `ranking` for the same purpose causes confusion.

**✅ Correct Usage:**
- **Slides:** Use `sortOrder` for manual ordering within a workspace
- **Metrics:** Use `ranking` for priority/importance (not sortOrder)
- **Never:** Mix both fields for the same entity

**Example:**
```typescript
// ✅ Slides ordering
await db.query.slides.findMany({
  orderBy: [asc(slides.sortOrder), desc(slides.createdAt)],
});

// ✅ Metrics ordering
await db.query.metrics.findMany({
  orderBy: [asc(metrics.ranking)], // Not sortOrder
});
```

### 5. Duplicate Data Fetching Logic

**Issue:** Copying fetch logic instead of using shared hooks leads to bugs and maintenance overhead.

**❌ Wrong - Duplicated in multiple files:**
```typescript
// In component A
const { data } = useQuery({
  queryKey: ["users"],
  queryFn: async () => {
    const response = await fetch("/api/users");
    return response.json(); // Bug: doesn't extract users
  },
});

// In component B (same bug duplicated)
const { data } = useQuery({
  queryKey: ["users"],
  queryFn: async () => {
    const response = await fetch("/api/users");
    return response.json(); // Same bug
  },
});
```

**✅ Correct - Use shared hook:**
```typescript
// In lib/api/users.ts (one place)
export function useUsers() {
  return useQuery({
    queryKey: userKeys.list(),
    queryFn: async () => {
      const response = await fetch("/api/users");
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      return data.users; // Correct extraction
    },
  });
}

// In all components (reuse the correct implementation)
const { data: users = [] } = useUsers();
```

## Code Review Checklist

When reviewing code that fetches data, check for:

### ✅ Response Extraction

- [ ] Does the query extract the correct field from the response?
- [ ] Example: `return data.users` not `return response.json()`

### ✅ Type Safety

- [ ] Is the return type correctly typed?
- [ ] Example: `Promise<User[]>` not `Promise<any>`

### ✅ Error Handling

- [ ] Does it check `response.ok` before parsing?
- [ ] Does it throw meaningful errors?

### ✅ Centralization

- [ ] Is the data fetching logic in a shared hook?
- [ ] Or is it duplicated across multiple files?

### ✅ Query Keys

- [ ] Uses centralized query key factory?
- [ ] Consistent across the codebase?

### ✅ Cache Configuration

- [ ] Appropriate `staleTime` and `gcTime`?
- [ ] Not over-fetching or under-caching?

### ✅ Schema Consistency

- [ ] Field names match schema documentation?
- [ ] Not mixing `sortOrder` and `ranking` incorrectly?

## Testing Patterns

### Testing API Hooks

```typescript
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useUsers } from "@/lib/api/users";

describe("useUsers", () => {
  it("fetches and returns users array", async () => {
    const queryClient = new QueryClient();
    const wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );

    const { result } = renderHook(() => useUsers(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(Array.isArray(result.current.data)).toBe(true);
    expect(result.current.data?.[0]).toHaveProperty("id");
  });
});
```

## Migration Guide

If you find code that doesn't follow these patterns:

### 1. Identify the Issue

Look for:
- Direct `fetch()` calls in components
- Missing response data extraction
- Duplicate query logic
- Inconsistent query keys

### 2. Create or Update Shared Hook

```typescript
// Create in src/lib/api/[resource].ts
export function useResource() {
  return useQuery({
    queryKey: resourceKeys.list(),
    queryFn: async () => {
      const response = await fetch("/api/resources");
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      return data.resources; // Extract the array
    },
  });
}
```

### 3. Replace Component Logic

```typescript
// Before
const { data } = useQuery({
  queryKey: ["resources"],
  queryFn: async () => {
    const response = await fetch("/api/resources");
    return response.json();
  },
});

// After
const { data: resources = [] } = useResource();
```

### 4. Update Tests

Ensure tests cover the new shared hook.

## Related Documentation

- [Schema Documentation](./SCHEMA.md) - Database schema and field definitions
- [Data Ingestion](./DATA_INGESTION.md) - API payload structures
- [Follow-up System](./FOLLOW_UP.md) - Follow-up task management patterns

## Summary

**Key Takeaways:**

1. **Always extract response data** - Don't return `response.json()` directly
2. **Use shared hooks** - Centralize data fetching logic in `src/lib/api/`
3. **Type everything** - Use TypeScript generics for type safety
4. **Handle errors** - Always check `response.ok`
5. **Consistent query keys** - Use query key factories
6. **Schema clarity** - Use `sortOrder` for slides, `ranking` for metrics, never mix them
7. **Code reviews** - Use the checklist to catch common pitfalls

Following these patterns will prevent bugs, improve maintainability, and ensure consistent behavior across the application.

