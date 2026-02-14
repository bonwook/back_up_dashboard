-- s3_updates 테이블에 task_id 컬럼이 없을 때만 실행 (담당자 지정 연동용)
-- 실행 전: SHOW COLUMNS FROM s3_updates; 로 task_id 존재 여부 확인

USE flonics_dashboard;

ALTER TABLE s3_updates
  ADD COLUMN task_id CHAR(36) DEFAULT NULL COMMENT '담당자 지정 후 연결된 task_assignments.id',
  ADD INDEX idx_task_id (task_id),
  ADD CONSTRAINT fk_s3_updates_task FOREIGN KEY (task_id) REFERENCES task_assignments(id) ON DELETE SET NULL;
