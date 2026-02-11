// Mock Supabase for testing
const supabaseMock = {
  auth: {
    getUser: jest.fn().mockResolvedValue({
      data: { user: { id: 'test-user-id', email: 'test@example.com' } },
      error: null
    }),
    signInWithPassword: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    onAuthStateChange: jest.fn()
  },
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(() => ({
          data: null,
          error: null
        })),
        limit: jest.fn()
      })),
      order: jest.fn(() => ({
        limit: jest.fn()
      })),
      range: jest.fn()
    })),
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn(() => ({
          data: { id: 'new-id' },
          error: null
        }))
      }))
    })),
    update: jest.fn(() => ({
      eq: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => ({
            data: { id: 'updated-id' },
            error: null
          }))
        }))
      }))
    })),
    delete: jest.fn(() => ({
      eq: jest.fn(() => ({
        data: null,
        error: null
      }))
    }))
  })),
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn(),
      getPublicUrl: jest.fn(() => ({ publicUrl: 'http://test.url' })),
      remove: jest.fn()
    }))
  }
};

module.exports = supabaseMock;


