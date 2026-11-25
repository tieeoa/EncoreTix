-- Tambah status aktif/nonaktif untuk akun panitia (admin).
-- MySQL 8 tidak mendukung ADD COLUMN IF NOT EXISTS, jadi guard via information_schema.
SET @col_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'panitia'
    AND COLUMN_NAME = 'status'
);

SET @ddl = IF(
  @col_exists = 0,
  'ALTER TABLE panitia ADD COLUMN status ENUM(''aktif'',''nonaktif'') NOT NULL DEFAULT ''aktif'' AFTER role',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
