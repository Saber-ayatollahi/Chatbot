-- Comprehensive Audit and Compliance Database Schema
-- Phase 5: Compliance & Audit System

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Main audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    
    -- Core interaction identifiers
    session_id VARCHAR(100) NOT NULL,
    message_id VARCHAR(100) NOT NULL UNIQUE,
    request_id VARCHAR(100),
    
    -- User interaction data (PII redacted)
    user_query TEXT NOT NULL,
    user_query_hash VARCHAR(64),
    final_response TEXT NOT NULL,
    final_response_hash VARCHAR(64),
    
    -- RAG system data
    retrieved_chunks JSONB,
    citations JSONB,
    sources JSONB,
    
    -- Quality and performance metrics
    confidence_score DECIMAL(3,2) DEFAULT 0,
    accuracy_score DECIMAL(3,2),
    response_time_ms INTEGER DEFAULT 0,
    token_count INTEGER DEFAULT 0,
    
    -- System metadata
    model_version VARCHAR(50),
    embedding_model VARCHAR(50),
    retrieval_strategy VARCHAR(50),
    template_type VARCHAR(50),
    
    -- Request context
    user_agent TEXT,
    ip_address VARCHAR(64), -- Hashed IP
    
    -- Compliance flags
    pii_detected BOOLEAN DEFAULT FALSE,
    content_flags JSONB DEFAULT '[]'::jsonb,
    compliance_status VARCHAR(20) DEFAULT 'compliant',
    
    -- Timestamps and retention
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    retention_until TIMESTAMP WITH TIME ZONE,
    
    -- Encrypted metadata
    metadata TEXT, -- Encrypted JSON
    
    -- Constraints
    CONSTRAINT chk_confidence_range CHECK (confidence_score >= 0 AND confidence_score <= 1),
    CONSTRAINT chk_accuracy_range CHECK (accuracy_score IS NULL OR (accuracy_score >= 0 AND accuracy_score <= 1)),
    CONSTRAINT chk_compliance_status CHECK (compliance_status IN ('compliant', 'non_compliant', 'under_review', 'approved'))
);

-- PII detection details table (separate for security)
CREATE TABLE IF NOT EXISTS audit_pii_details (
    id SERIAL PRIMARY KEY,
    audit_log_id INTEGER NOT NULL REFERENCES audit_logs(id) ON DELETE CASCADE,
    pii_report TEXT NOT NULL, -- Encrypted PII detection report
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Security constraints
    CONSTRAINT uk_audit_pii UNIQUE (audit_log_id)
);

-- Session statistics table
CREATE TABLE IF NOT EXISTS audit_session_stats (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(100) NOT NULL UNIQUE,
    
    -- Interaction counts
    total_interactions INTEGER DEFAULT 0,
    successful_interactions INTEGER DEFAULT 0,
    failed_interactions INTEGER DEFAULT 0,
    
    -- Quality metrics
    total_tokens INTEGER DEFAULT 0,
    avg_confidence DECIMAL(3,2) DEFAULT 0,
    avg_accuracy DECIMAL(3,2),
    avg_response_time INTEGER DEFAULT 0,
    
    -- Compliance metrics
    pii_detections INTEGER DEFAULT 0,
    compliance_violations INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    
    -- Session metadata
    first_interaction TIMESTAMP WITH TIME ZONE,
    last_interaction TIMESTAMP WITH TIME ZONE,
    session_duration INTEGER, -- in seconds
    
    -- User context (anonymized)
    user_agent_hash VARCHAR(64),
    ip_address_hash VARCHAR(64),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit errors table
CREATE TABLE IF NOT EXISTS audit_errors (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(100),
    error_message TEXT NOT NULL,
    error_stack TEXT,
    error_code VARCHAR(50),
    interaction_data JSONB,
    
    -- Error context
    severity VARCHAR(20) DEFAULT 'error', -- info, warning, error, critical
    category VARCHAR(50), -- system, validation, pii, compliance
    resolved BOOLEAN DEFAULT FALSE,
    resolution_notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT chk_severity CHECK (severity IN ('info', 'warning', 'error', 'critical'))
);

-- Compliance reports table
CREATE TABLE IF NOT EXISTS compliance_reports (
    id SERIAL PRIMARY KEY,
    report_type VARCHAR(50) NOT NULL, -- daily, weekly, monthly, quarterly, annual, custom
    report_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    report_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Report content
    report_data JSONB NOT NULL,
    report_summary TEXT,
    
    -- Generation metadata
    generated_by VARCHAR(100), -- user or system
    generation_time INTEGER, -- milliseconds
    total_records INTEGER,
    
    -- Report status
    status VARCHAR(20) DEFAULT 'generated', -- generated, reviewed, approved, archived
    reviewed_by VARCHAR(100),
    approved_by VARCHAR(100),
    
    -- File exports
    export_formats JSONB DEFAULT '[]'::jsonb, -- Available export formats
    file_paths JSONB DEFAULT '{}'::jsonb, -- File storage paths
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    approved_at TIMESTAMP WITH TIME ZONE,
    archived_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT chk_report_status CHECK (status IN ('generated', 'reviewed', 'approved', 'archived'))
);

-- Data retention policies table
CREATE TABLE IF NOT EXISTS data_retention_policies (
    id SERIAL PRIMARY KEY,
    policy_name VARCHAR(100) NOT NULL UNIQUE,
    data_type VARCHAR(50) NOT NULL, -- audit_logs, pii_details, session_stats, etc.
    
    -- Retention rules
    retention_days INTEGER NOT NULL,
    auto_delete BOOLEAN DEFAULT TRUE,
    archive_before_delete BOOLEAN DEFAULT FALSE,
    archive_location VARCHAR(255),
    
    -- Policy conditions
    conditions JSONB DEFAULT '{}'::jsonb, -- Additional conditions for retention
    
    -- Policy metadata
    description TEXT,
    compliance_requirement VARCHAR(100), -- GDPR, CCPA, SOX, etc.
    created_by VARCHAR(100),
    
    -- Status
    active BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_applied TIMESTAMP WITH TIME ZONE
);

-- User access logs table (for admin dashboard access)
CREATE TABLE IF NOT EXISTS admin_access_logs (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    username VARCHAR(100),
    
    -- Access details
    action VARCHAR(100) NOT NULL, -- login, logout, view_logs, export_data, etc.
    resource VARCHAR(100), -- specific resource accessed
    resource_id VARCHAR(100), -- specific record ID if applicable
    
    -- Request details
    ip_address VARCHAR(64), -- Hashed
    user_agent TEXT,
    request_method VARCHAR(10),
    request_path TEXT,
    
    -- Result
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    
    -- Data accessed
    records_accessed INTEGER DEFAULT 0,
    data_exported BOOLEAN DEFAULT FALSE,
    export_format VARCHAR(20),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    session_start TIMESTAMP WITH TIME ZONE,
    session_end TIMESTAMP WITH TIME ZONE
);

-- Compliance violations table
CREATE TABLE IF NOT EXISTS compliance_violations (
    id SERIAL PRIMARY KEY,
    audit_log_id INTEGER REFERENCES audit_logs(id) ON DELETE SET NULL,
    
    -- Violation details
    violation_type VARCHAR(50) NOT NULL, -- pii_exposure, data_breach, policy_violation
    severity VARCHAR(20) NOT NULL, -- low, medium, high, critical
    description TEXT NOT NULL,
    
    -- Detection details
    detected_by VARCHAR(50), -- system, manual, audit
    detection_method VARCHAR(100),
    confidence_score DECIMAL(3,2),
    
    -- Resolution tracking
    status VARCHAR(20) DEFAULT 'open', -- open, investigating, resolved, false_positive
    assigned_to VARCHAR(100),
    resolution_notes TEXT,
    corrective_actions JSONB,
    
    -- Impact assessment
    impact_level VARCHAR(20), -- minimal, moderate, significant, severe
    affected_records INTEGER DEFAULT 1,
    data_types_affected JSONB,
    
    -- Timestamps
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT chk_violation_severity CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    CONSTRAINT chk_violation_status CHECK (status IN ('open', 'investigating', 'resolved', 'false_positive')),
    CONSTRAINT chk_impact_level CHECK (impact_level IN ('minimal', 'moderate', 'significant', 'severe'))
);

-- Data anonymization log
CREATE TABLE IF NOT EXISTS data_anonymization_log (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    record_id INTEGER,
    
    -- Anonymization details
    anonymization_type VARCHAR(50) NOT NULL, -- redaction, masking, deletion, encryption
    fields_affected JSONB NOT NULL,
    reason VARCHAR(100), -- retention_expired, user_request, compliance
    
    -- Process metadata
    processed_by VARCHAR(100), -- system or user
    processing_method VARCHAR(50), -- automatic, manual
    
    -- Verification
    verification_hash VARCHAR(64), -- Hash of original data for verification
    reversible BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    scheduled_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT chk_anonymization_type CHECK (anonymization_type IN ('redaction', 'masking', 'deletion', 'encryption'))
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_audit_logs_session_id ON audit_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_compliance_status ON audit_logs(compliance_status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_pii_detected ON audit_logs(pii_detected);
CREATE INDEX IF NOT EXISTS idx_audit_logs_retention_until ON audit_logs(retention_until);
CREATE INDEX IF NOT EXISTS idx_audit_logs_message_id ON audit_logs(message_id);

CREATE INDEX IF NOT EXISTS idx_audit_session_stats_session_id ON audit_session_stats(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_session_stats_last_interaction ON audit_session_stats(last_interaction);

CREATE INDEX IF NOT EXISTS idx_audit_errors_session_id ON audit_errors(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_errors_created_at ON audit_errors(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_errors_severity ON audit_errors(severity);
CREATE INDEX IF NOT EXISTS idx_audit_errors_resolved ON audit_errors(resolved);

CREATE INDEX IF NOT EXISTS idx_compliance_reports_type_period ON compliance_reports(report_type, report_period_start, report_period_end);
CREATE INDEX IF NOT EXISTS idx_compliance_reports_status ON compliance_reports(status);
CREATE INDEX IF NOT EXISTS idx_compliance_reports_created_at ON compliance_reports(created_at);

CREATE INDEX IF NOT EXISTS idx_admin_access_logs_user_id ON admin_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_access_logs_created_at ON admin_access_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_access_logs_action ON admin_access_logs(action);

CREATE INDEX IF NOT EXISTS idx_compliance_violations_status ON compliance_violations(status);
CREATE INDEX IF NOT EXISTS idx_compliance_violations_severity ON compliance_violations(severity);
CREATE INDEX IF NOT EXISTS idx_compliance_violations_detected_at ON compliance_violations(detected_at);

CREATE INDEX IF NOT EXISTS idx_data_anonymization_log_table_record ON data_anonymization_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_data_anonymization_log_processed_at ON data_anonymization_log(processed_at);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_session_date ON audit_logs(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_compliance_date ON audit_logs(compliance_status, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_pii_date ON audit_logs(pii_detected, created_at);

-- Partial indexes for efficiency
CREATE INDEX IF NOT EXISTS idx_audit_logs_non_compliant ON audit_logs(id) WHERE compliance_status != 'compliant';
CREATE INDEX IF NOT EXISTS idx_audit_logs_pii_detected ON audit_logs(id) WHERE pii_detected = TRUE;
CREATE INDEX IF NOT EXISTS idx_audit_errors_unresolved ON audit_errors(id) WHERE resolved = FALSE;
CREATE INDEX IF NOT EXISTS idx_compliance_violations_open ON compliance_violations(id) WHERE status = 'open';

-- Functions for automated maintenance

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER trigger_audit_logs_updated_at
    BEFORE UPDATE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_audit_session_stats_updated_at
    BEFORE UPDATE ON audit_session_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_data_retention_policies_updated_at
    BEFORE UPDATE ON data_retention_policies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically clean up expired audit logs
CREATE OR REPLACE FUNCTION cleanup_expired_audit_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Archive logs before deletion if required by policy
    INSERT INTO archived_audit_logs 
    SELECT * FROM audit_logs 
    WHERE retention_until < NOW() 
    AND id IN (
        SELECT al.id FROM audit_logs al
        JOIN data_retention_policies drp ON drp.data_type = 'audit_logs'
        WHERE drp.archive_before_delete = TRUE
        AND drp.active = TRUE
    );
    
    -- Delete expired logs
    DELETE FROM audit_logs WHERE retention_until < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log the cleanup operation
    INSERT INTO audit_errors (
        session_id, error_message, severity, category, created_at
    ) VALUES (
        'system', 
        'Automated cleanup: ' || deleted_count || ' expired audit logs deleted',
        'info',
        'system',
        NOW()
    );
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to generate compliance report data
CREATE OR REPLACE FUNCTION generate_compliance_stats(
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE
)
RETURNS JSONB AS $$
DECLARE
    stats JSONB;
BEGIN
    SELECT jsonb_build_object(
        'period_start', start_date,
        'period_end', end_date,
        'total_interactions', COUNT(*),
        'unique_sessions', COUNT(DISTINCT session_id),
        'pii_detections', COUNT(*) FILTER (WHERE pii_detected = TRUE),
        'compliance_violations', COUNT(*) FILTER (WHERE compliance_status != 'compliant'),
        'avg_confidence', ROUND(AVG(confidence_score)::numeric, 3),
        'avg_response_time', ROUND(AVG(response_time_ms)::numeric, 0),
        'error_rate', ROUND(
            (COUNT(*) FILTER (WHERE content_flags::jsonb ? 'error_occurred'))::numeric / COUNT(*)::numeric * 100, 2
        ),
        'category_breakdown', (
            SELECT jsonb_object_agg(
                COALESCE(retrieved_chunks->0->>'category', 'unknown'),
                category_count
            )
            FROM (
                SELECT 
                    COALESCE(retrieved_chunks->0->>'category', 'unknown') as category,
                    COUNT(*) as category_count
                FROM audit_logs
                WHERE created_at >= start_date AND created_at <= end_date
                GROUP BY COALESCE(retrieved_chunks->0->>'category', 'unknown')
            ) category_stats
        ),
        'daily_breakdown', (
            SELECT jsonb_object_agg(
                interaction_date::text,
                daily_count
            )
            FROM (
                SELECT 
                    DATE(created_at) as interaction_date,
                    COUNT(*) as daily_count
                FROM audit_logs
                WHERE created_at >= start_date AND created_at <= end_date
                GROUP BY DATE(created_at)
                ORDER BY interaction_date
            ) daily_stats
        )
    ) INTO stats
    FROM audit_logs
    WHERE created_at >= start_date AND created_at <= end_date;
    
    RETURN COALESCE(stats, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- Create archived audit logs table for long-term storage
CREATE TABLE IF NOT EXISTS archived_audit_logs (
    LIKE audit_logs INCLUDING ALL
);

-- Add archival timestamp
ALTER TABLE archived_audit_logs ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create index on archived table
CREATE INDEX IF NOT EXISTS idx_archived_audit_logs_archived_at ON archived_audit_logs(archived_at);
CREATE INDEX IF NOT EXISTS idx_archived_audit_logs_original_created_at ON archived_audit_logs(created_at);

-- Views for common compliance queries

-- Active sessions view
CREATE OR REPLACE VIEW active_sessions AS
SELECT 
    s.*,
    CASE 
        WHEN s.last_interaction > NOW() - INTERVAL '1 hour' THEN 'active'
        WHEN s.last_interaction > NOW() - INTERVAL '24 hours' THEN 'recent'
        ELSE 'inactive'
    END as session_status
FROM audit_session_stats s
WHERE s.last_interaction > NOW() - INTERVAL '7 days';

-- Compliance summary view
CREATE OR REPLACE VIEW compliance_summary AS
SELECT 
    DATE(created_at) as report_date,
    COUNT(*) as total_interactions,
    COUNT(DISTINCT session_id) as unique_sessions,
    COUNT(*) FILTER (WHERE pii_detected = TRUE) as pii_detections,
    COUNT(*) FILTER (WHERE compliance_status != 'compliant') as violations,
    ROUND(AVG(confidence_score), 3) as avg_confidence,
    ROUND(AVG(response_time_ms)) as avg_response_time,
    COUNT(*) FILTER (WHERE content_flags::jsonb ? 'error_occurred') as error_count
FROM audit_logs
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY report_date DESC;

-- PII detection summary view
CREATE OR REPLACE VIEW pii_detection_summary AS
SELECT 
    DATE(created_at) as detection_date,
    COUNT(*) as total_detections,
    COUNT(DISTINCT session_id) as affected_sessions,
    jsonb_object_agg(
        pii_type,
        type_count
    ) as detection_breakdown
FROM (
    SELECT 
        created_at,
        session_id,
        jsonb_array_elements_text(
            CASE 
                WHEN jsonb_typeof(content_flags) = 'array' THEN content_flags
                ELSE '[]'::jsonb
            END
        ) as pii_type,
        1 as type_count
    FROM audit_logs
    WHERE pii_detected = TRUE
    AND created_at >= NOW() - INTERVAL '30 days'
) pii_data
GROUP BY DATE(created_at)
ORDER BY detection_date DESC;

-- Grant appropriate permissions (adjust based on your user roles)
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO compliance_reader;
-- GRANT SELECT, INSERT, UPDATE ON audit_logs TO audit_writer;
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO audit_admin;

-- Insert default retention policies
INSERT INTO data_retention_policies (
    policy_name, data_type, retention_days, description, compliance_requirement
) VALUES 
    ('Standard Audit Logs', 'audit_logs', 365, 'Standard retention for audit logs', 'SOX'),
    ('PII Detection Details', 'audit_pii_details', 90, 'PII detection reports with shorter retention', 'GDPR'),
    ('Session Statistics', 'audit_session_stats', 730, 'Session statistics for analysis', 'Internal'),
    ('Compliance Reports', 'compliance_reports', 2555, 'Long-term retention for compliance reports', 'SOX'),
    ('Admin Access Logs', 'admin_access_logs', 365, 'Administrative access audit trail', 'SOX'),
    ('Error Logs', 'audit_errors', 180, 'System error logs for debugging', 'Internal')
ON CONFLICT (policy_name) DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE audit_logs IS 'Main audit log table storing all user interactions with PII redaction';
COMMENT ON TABLE audit_pii_details IS 'Detailed PII detection reports stored separately for security';
COMMENT ON TABLE audit_session_stats IS 'Aggregated statistics per user session';
COMMENT ON TABLE compliance_reports IS 'Generated compliance reports for regulatory requirements';
COMMENT ON TABLE compliance_violations IS 'Detected compliance violations requiring investigation';
COMMENT ON TABLE data_retention_policies IS 'Configurable data retention policies for different data types';

COMMENT ON COLUMN audit_logs.user_query IS 'User query with PII redacted';
COMMENT ON COLUMN audit_logs.ip_address IS 'Hashed IP address for privacy';
COMMENT ON COLUMN audit_logs.metadata IS 'Encrypted additional metadata';
COMMENT ON COLUMN audit_logs.retention_until IS 'Date when this record should be deleted';

-- Create a function to validate the schema
CREATE OR REPLACE FUNCTION validate_audit_schema()
RETURNS TEXT AS $$
DECLARE
    result TEXT := 'Audit schema validation: ';
    table_count INTEGER;
    index_count INTEGER;
    function_count INTEGER;
BEGIN
    -- Check tables
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN (
        'audit_logs', 'audit_pii_details', 'audit_session_stats',
        'audit_errors', 'compliance_reports', 'data_retention_policies',
        'admin_access_logs', 'compliance_violations', 'data_anonymization_log',
        'archived_audit_logs'
    );
    
    result := result || table_count || ' tables created. ';
    
    -- Check indexes
    SELECT COUNT(*) INTO index_count
    FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND indexname LIKE 'idx_audit%' OR indexname LIKE 'idx_compliance%' OR indexname LIKE 'idx_admin%' OR indexname LIKE 'idx_data%';
    
    result := result || index_count || ' indexes created. ';
    
    -- Check functions
    SELECT COUNT(*) INTO function_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname IN ('cleanup_expired_audit_logs', 'generate_compliance_stats', 'update_updated_at_column');
    
    result := result || function_count || ' functions created. ';
    
    IF table_count >= 10 AND index_count >= 15 AND function_count >= 3 THEN
        result := result || 'Schema validation PASSED.';
    ELSE
        result := result || 'Schema validation FAILED.';
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;
