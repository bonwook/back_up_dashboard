-- MySQL Schema for Flonics 4D Flow MRI Analysis Dashboard
-- Compatible with AWS Aurora MySQL

-- Create profiles table (user management with authentication)
CREATE TABLE IF NOT EXISTS profiles (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  organization VARCHAR(255),
  role ENUM('admin', 'client', 'staff') NOT NULL DEFAULT 'client',
  memo TEXT DEFAULT NULL COMMENT 'User notes/memo',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create cases table for DICOM data management (created before user_files due to FK dependency)
CREATE TABLE IF NOT EXISTS cases (
  id CHAR(36) PRIMARY KEY,
  case_number VARCHAR(100) NOT NULL UNIQUE,
  patient_name VARCHAR(255) NOT NULL,
  study_date DATE NOT NULL,
  data_type VARCHAR(255) NOT NULL,
  client_id CHAR(36) NOT NULL,
  client_organization VARCHAR(255),
  dicom_source ENUM('aws_s3', 'email'),
  s3_path TEXT COMMENT 'Legacy field, use file_id instead',
  file_id CHAR(36) DEFAULT NULL COMMENT 'Reference to user_files table',
  status ENUM('registered', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'registered',
  assigned_to CHAR(36),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES profiles(id) ON DELETE RESTRICT,
  FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE SET NULL,
  INDEX idx_case_number (case_number),
  INDEX idx_client_id (client_id),
  INDEX idx_status (status),
  INDEX idx_assigned_to (assigned_to),
  INDEX idx_created_at (created_at),
  INDEX idx_file_id (file_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create reports table for HTML report storage
CREATE TABLE IF NOT EXISTS reports (
  id CHAR(36) PRIMARY KEY,
  case_id CHAR(36) NOT NULL,
  report_html LONGTEXT,
  staff_comments TEXT,
  client_comments TEXT,
  report_file_url TEXT COMMENT 'Legacy field, use file_id instead',
  file_id CHAR(36) DEFAULT NULL COMMENT 'Reference to user_files table',
  uploaded_by CHAR(36) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE RESTRICT,
  INDEX idx_case_id (case_id),
  INDEX idx_uploaded_by (uploaded_by),
  INDEX idx_created_at (created_at),
  INDEX idx_file_id (file_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create user_files table to track all files uploaded by users
-- Created after cases and reports tables due to foreign key dependencies
CREATE TABLE IF NOT EXISTS user_files (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL COMMENT 'Full S3 path (s3://bucket/key)',
  s3_key VARCHAR(500) NOT NULL COMMENT 'S3 object key',
  s3_bucket VARCHAR(255) NOT NULL,
  file_size BIGINT DEFAULT 0 COMMENT 'File size in bytes',
  content_type VARCHAR(100),
  file_type ENUM('dicom', 'report', 'document', 'image', 'excel', 'pdf', 'other') DEFAULT 'other',
  case_id CHAR(36) DEFAULT NULL COMMENT 'Associated case if applicable',
  report_id CHAR(36) DEFAULT NULL COMMENT 'Associated report if applicable',
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE SET NULL,
  FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_case_id (case_id),
  INDEX idx_report_id (report_id),
  INDEX idx_file_type (file_type),
  INDEX idx_uploaded_at (uploaded_at),
  INDEX idx_s3_bucket_key (s3_bucket, s3_key(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Note: Foreign keys for file_id in cases and reports are added via ALTER TABLE
-- after user_files table is created. Run these commands separately if needed:
-- ALTER TABLE cases ADD CONSTRAINT fk_cases_file_id FOREIGN KEY (file_id) REFERENCES user_files(id) ON DELETE SET NULL;
-- ALTER TABLE reports ADD CONSTRAINT fk_reports_file_id FOREIGN KEY (file_id) REFERENCES user_files(id) ON DELETE SET NULL;

-- Create billing table for invoice management
CREATE TABLE IF NOT EXISTS billing (
  id CHAR(36) PRIMARY KEY,
  case_id CHAR(36) NOT NULL,
  amount DECIMAL(10, 2),
  currency VARCHAR(10) DEFAULT 'USD',
  status ENUM('pending', 'paid', 'cancelled') NOT NULL DEFAULT 'pending',
  invoice_date DATE,
  paid_date DATE,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
  INDEX idx_case_id (case_id),
  INDEX idx_status (status),
  INDEX idx_invoice_date (invoice_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create audit_log table for activity tracking
CREATE TABLE IF NOT EXISTS audit_log (
  id CHAR(36) PRIMARY KEY,
  case_id CHAR(36),
  user_id CHAR(36),
  action VARCHAR(255) NOT NULL,
  details JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL,
  INDEX idx_case_id (case_id),
  INDEX idx_user_id (user_id),
  INDEX idx_action (action),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
