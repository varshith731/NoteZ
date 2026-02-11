# Testing Guide for NoteZ

## Overview
This guide explains how to test the NoteZ music management system using modern testing frameworks.

## Testing Frameworks Used

### Frontend (React + Vite)
- **Vitest**: Fast unit test runner for Vite projects
- **React Testing Library**: Component testing utilities
- **@testing-library/user-event**: Simulate user interactions

### Backend (Node.js + Express)
- **Jest**: JavaScript testing framework
- **Supertest**: HTTP assertions for testing API endpoints

### E2E Testing (Optional)
- **Cypress** or **Playwright**: End-to-end testing (already in dependencies)

---

## Setup Instructions

### 1. Install Dependencies

#### Frontend
```bash
cd frontend
npm install
```

#### Backend
```bash
cd backend
npm install
```

### 2. Run Tests

#### Frontend Tests
```bash
cd frontend

# Run all tests
npm test

# Run tests in watch mode (auto-rerun on file changes)
npm run test

# Run tests with coverage report
npm run test:coverage

# Open UI test runner (visual interface)
npm run test:ui
```

#### Backend Tests
```bash
cd backend

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

---

## What Gets Tested

### Frontend Tests
1. **Component Rendering**: Tests check if components render correctly
2. **User Interactions**: Button clicks, form submissions
3. **State Management**: State changes and updates
4. **API Mocking**: Simulates API calls without hitting real servers

### Backend Tests
1. **API Endpoints**: Tests HTTP requests to routes
2. **Authentication**: Token validation and user auth
3. **Data Validation**: Input validation and error handling
4. **Database Operations**: CRUD operations (mocked)

---

## Example Test Files

### Frontend Example: `ContentCreatorDashboard.test.tsx`
```typescript
// Tests if the dashboard renders correctly
it('renders the dashboard with profile section', async () => {
  render(<ContentCreatorDashboard />);
  expect(screen.getByText(/Creator Dashboard/i)).toBeInTheDocument();
});
```

### Backend Example: `users.test.js`
```javascript
// Tests if user profile endpoint requires authentication
it('should require authentication', async () => {
  const response = await request(app)
    .get('/api/users/me');
  expect(response.status).toBe(401);
});
```

---

## Writing Your Own Tests

### Frontend Component Test Template
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import YourComponent from './YourComponent';

describe('YourComponent', () => {
  it('renders correctly', () => {
    render(<YourComponent />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });

  it('handles user interactions', async () => {
    const user = userEvent.setup();
    render(<YourComponent />);
    
    const button = screen.getByRole('button');
    await user.click(button);
    
    expect(screen.getByText('Changed Text')).toBeInTheDocument();
  });
});
```

### Backend API Test Template
```javascript
const request = require('supertest');

describe('Your API Endpoint', () => {
  it('should return expected response', async () => {
    const response = await request(app)
      .get('/api/your-endpoint')
      .set('Authorization', 'Bearer token')
      .expect(200);
    
    expect(response.body).toHaveProperty('expectedField');
  });
});
```

---

## Test Coverage Goals

- **Minimum**: 70% code coverage
- **Good**: 80%+ code coverage
- **Components to prioritize**:
  - Authentication flows
  - API endpoints
  - Critical user flows (upload, search, play)
  - Error handling

---

## Best Practices

### 1. **Test User Behavior, Not Implementation**
```typescript
// ❌ Bad - Testing implementation details
expect(component.state.isOpen).toBe(true);

// ✅ Good - Testing user-visible behavior
expect(screen.getByText('Success')).toBeInTheDocument();
```

### 2. **Use Descriptive Test Names**
```typescript
// ✅ Good
it('displays error message when upload fails', () => {});
```

### 3. **Mock External Dependencies**
```typescript
// Mock API calls
global.fetch = vi.fn().mockResolvedValueOnce({
  ok: true,
  json: async () => ({ data: 'mock' })
});
```

### 4. **Clean Up After Tests**
```javascript
afterEach(() => {
  jest.clearAllMocks();
});
```

---

## Common Commands

### Frontend
- `npm test` - Run all tests
- `npm run test:ui` - Open visual test runner
- `npm run test:coverage` - Generate coverage report

### Backend
- `npm test` - Run all tests once
- `npm run test:watch` - Watch mode
- `npm run test:coverage` - Coverage report

---

## Debugging Tests

### Frontend
```bash
# Run specific test file
npm test ContentCreatorDashboard

# Run tests matching pattern
npm test -- -t "renders the dashboard"
```

### Backend
```bash
# Run specific test file
npm test users.test.js

# Run with verbose output
npm test -- --verbose
```

---

## CI/CD Integration

Add these to your GitHub Actions workflow:

```yaml
# In .github/workflows/test.yml
- name: Run Frontend Tests
  run: |
    cd frontend
    npm test -- --run

- name: Run Backend Tests
  run: |
    cd backend
    npm test
```

---

## Additional Resources

- **Vitest Docs**: https://vitest.dev/
- **React Testing Library**: https://testing-library.com/react
- **Jest Docs**: https://jestjs.io/
- **Supertest**: https://github.com/visionmedia/supertest

---

## Quick Start for Your Project

1. **Install dependencies**:
   ```bash
   cd frontend && npm install
   cd ../backend && npm install
   ```

2. **Run tests**:
   ```bash
   # Frontend
   cd frontend && npm test
   
   # Backend
   cd backend && npm test
   ```

3. **Check coverage**:
   ```bash
   cd frontend && npm run test:coverage
   cd ../backend && npm run test:coverage
   ```

4. **View results**: Check the `coverage/` folders in each directory for HTML reports.

---

## Tips

- Write tests **before** implementing features (TDD) when possible
- Focus on testing **critical paths** first
- Keep tests **fast and isolated**
- **Mock external APIs** to avoid hitting real services
- Use **snapshot testing** sparingly (can be brittle)

Good luck with your testing! 🧪

