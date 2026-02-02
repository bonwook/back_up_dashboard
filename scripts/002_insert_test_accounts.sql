-- Create test accounts for Flonics dashboard
-- Run this after schema creation

-- Admin account: admin@flonics.test / Admin123!
-- Password hash for 'Admin123!' using bcrypt
INSERT INTO profiles (id, email, password_hash, full_name, organization, role, created_at, updated_at)
VALUES (
  UUID(),
  'admin@flonics.test',
  '$2a$10$rQYZqH.LvqJxQX1N5K7zTelwq4vSCZo3GJlOBQl8l1mNRvY.BQa7e',
  'Test Admin',
  'Flonics',
  'admin',
  NOW(),
  NOW()
) ON DUPLICATE KEY UPDATE email = email;

-- Client account: client@flonics.test / Client123!
-- Password hash for 'Client123!' using bcrypt  
INSERT INTO profiles (id, email, password_hash, full_name, organization, role, created_at, updated_at)
VALUES (
  UUID(),
  'client@flonics.test',
  '$2a$10$wU8kZk3Rp.rR6XkH.K7zTeVvY4vSCZo3GJlOBQl8l1mNRvY.BQb8f',
  'Test Client',
  'Test Hospital',
  'client',
  NOW(),
  NOW()
) ON DUPLICATE KEY UPDATE email = email;

-- Verify accounts
SELECT id, email, full_name, organization, role, created_at 
FROM profiles 
WHERE email IN ('admin@flonics.test', 'client@flonics.test');
