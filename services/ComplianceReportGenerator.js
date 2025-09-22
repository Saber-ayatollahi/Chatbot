/**
 * Compliance Report Generator
 * Automated generation of compliance reports for regulatory requirements
 */

const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');
const logger = require('../utils/logger');
const { getConfig } = require('../config/environment');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

class ComplianceReportGenerator {
  constructor() {
    this.config = getConfig();
    
    // Robust configuration handling for both runtime and test environments
    const connectionString = this.config?.database?.url || 
                            process.env.DATABASE_URL || 
                            'postgresql://postgres:@localhost:5432/fund_chatbot';
    
    this.pool = new Pool({
      connectionString: connectionString,
      max: 10,
    });
    this.reportTypes = {
      daily: 'Daily Interaction Summary',
      weekly: 'Weekly Performance Report', 
      monthly: 'Monthly Compliance Report',
      quarterly: 'Quarterly Audit Report',
      annual: 'Annual Compliance Review',
      custom: 'Custom Period Report',
    };
  }

  /**
   * Generate comprehensive compliance report
   */
  async generateReport(reportConfig) {
    const startTime = Date.now();
    
    try {
      // Validate report configuration
      this.validateReportConfig(reportConfig);

      logger.info('Starting compliance report generation', {
        type: reportConfig.type,
        period: `${reportConfig.startDate} to ${reportConfig.endDate}`,
      });

      // Collect report data
      const reportData = await this.collectReportData(reportConfig);

      // Generate report content
      const reportContent = await this.generateReportContent(reportData, reportConfig);

      // Store report in database
      const reportId = await this.storeReport(reportContent, reportConfig);

      // Generate export files if requested
      const exportFiles = {};
      if (reportConfig.exportFormats) {
        for (const format of reportConfig.exportFormats) {
          const filePath = await this.exportReport(reportContent, format, reportId);
          exportFiles[format] = filePath;
        }
      }

      const executionTime = Date.now() - startTime;
      
      logger.info('Compliance report generated successfully', {
        reportId,
        executionTime: `${executionTime}ms`,
        exportFormats: Object.keys(exportFiles),
      });

      return {
        reportId,
        reportData: reportContent,
        exportFiles,
        executionTime,
      };

    } catch (error) {
      logger.error('Failed to generate compliance report:', error);
      throw error;
    }
  }

  /**
   * Collect all data needed for the report
   */
  async collectReportData(config) {
    const client = await this.pool.connect();
    
    try {
      const reportData = {
        metadata: {
          reportType: config.type,
          periodStart: config.startDate,
          periodEnd: config.endDate,
          generatedAt: new Date().toISOString(),
          generatedBy: config.generatedBy || 'system',
        },
        summary: {},
        details: {},
        compliance: {},
        performance: {},
        security: {},
      };

      // Collect summary statistics
      reportData.summary = await this.collectSummaryStats(client, config);

      // Collect detailed interaction data
      reportData.details = await this.collectDetailedStats(client, config);

      // Collect compliance metrics
      reportData.compliance = await this.collectComplianceMetrics(client, config);

      // Collect performance metrics
      reportData.performance = await this.collectPerformanceMetrics(client, config);

      // Collect security metrics
      reportData.security = await this.collectSecurityMetrics(client, config);

      // Add trend analysis for longer periods
      if (config.includeTrends) {
        reportData.trends = await this.collectTrendAnalysis(client, config);
      }

      // Add recommendations based on data
      reportData.recommendations = await this.generateRecommendations(reportData);

      return reportData;

    } finally {
      client.release();
    }
  }

  /**
   * Collect summary statistics
   */
  async collectSummaryStats(client, config) {
    const query = `
      SELECT 
        COUNT(*) as total_interactions,
        COUNT(DISTINCT session_id) as unique_sessions,
        COUNT(*) FILTER (WHERE pii_detected = TRUE) as pii_detections,
        COUNT(*) FILTER (WHERE compliance_status != 'compliant') as compliance_violations,
        ROUND(AVG(confidence_score)::numeric, 3) as avg_confidence,
        ROUND(AVG(response_time_ms)::numeric, 0) as avg_response_time,
        COUNT(*) FILTER (WHERE jsonb_array_length(content_flags) > 0) as flagged_interactions,
        SUM(token_count) as total_tokens,
        MIN(created_at) as first_interaction,
        MAX(created_at) as last_interaction
      FROM audit_logs
      WHERE created_at >= $1 AND created_at <= $2
    `;

    const result = await client.query(query, [config.startDate, config.endDate]);
    return result.rows[0];
  }

  /**
   * Collect detailed statistics
   */
  async collectDetailedStats(client, config) {
    const details = {};

    // Daily breakdown
    const dailyQuery = `
      SELECT 
        DATE(created_at) as interaction_date,
        COUNT(*) as interactions,
        COUNT(DISTINCT session_id) as sessions,
        AVG(confidence_score) as avg_confidence,
        AVG(response_time_ms) as avg_response_time,
        COUNT(*) FILTER (WHERE pii_detected = TRUE) as pii_detections
      FROM audit_logs
      WHERE created_at >= $1 AND created_at <= $2
      GROUP BY DATE(created_at)
      ORDER BY interaction_date
    `;

    const dailyResult = await client.query(dailyQuery, [config.startDate, config.endDate]);
    details.dailyBreakdown = dailyResult.rows;

    // Category breakdown
    const categoryQuery = `
      SELECT 
        COALESCE(
          retrieved_chunks->0->>'category', 
          'unknown'
        ) as category,
        COUNT(*) as interactions,
        AVG(confidence_score) as avg_confidence,
        AVG(response_time_ms) as avg_response_time
      FROM audit_logs
      WHERE created_at >= $1 AND created_at <= $2
      GROUP BY COALESCE(retrieved_chunks->0->>'category', 'unknown')
      ORDER BY interactions DESC
    `;

    const categoryResult = await client.query(categoryQuery, [config.startDate, config.endDate]);
    details.categoryBreakdown = categoryResult.rows;

    // Model performance breakdown
    const modelQuery = `
      SELECT 
        model_version,
        COUNT(*) as interactions,
        AVG(confidence_score) as avg_confidence,
        AVG(response_time_ms) as avg_response_time,
        COUNT(*) FILTER (WHERE pii_detected = TRUE) as pii_detections
      FROM audit_logs
      WHERE created_at >= $1 AND created_at <= $2
      GROUP BY model_version
      ORDER BY interactions DESC
    `;

    const modelResult = await client.query(modelQuery, [config.startDate, config.endDate]);
    details.modelBreakdown = modelResult.rows;

    return details;
  }

  /**
   * Collect compliance metrics
   */
  async collectComplianceMetrics(client, config) {
    const compliance = {};

    // PII detection analysis
    const piiQuery = `
      SELECT 
        COUNT(*) as total_pii_detections,
        COUNT(DISTINCT session_id) as sessions_with_pii,
        jsonb_object_agg(
          pii_type,
          type_count
        ) as pii_type_breakdown
      FROM (
        SELECT 
          session_id,
          jsonb_array_elements_text(
            CASE 
              WHEN jsonb_typeof(content_flags) = 'array' 
              THEN content_flags
              ELSE '[]'::jsonb
            END
          ) as pii_type,
          COUNT(*) as type_count
        FROM audit_logs
        WHERE pii_detected = TRUE
        AND created_at >= $1 AND created_at <= $2
        GROUP BY session_id, pii_type
      ) pii_data
    `;

    const piiResult = await client.query(piiQuery, [config.startDate, config.endDate]);
    compliance.piiAnalysis = piiResult.rows[0] || {
      total_pii_detections: 0,
      sessions_with_pii: 0,
      pii_type_breakdown: {},
    };

    // Compliance violations
    const violationsQuery = `
      SELECT 
        violation_type,
        severity,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
        COUNT(*) FILTER (WHERE status = 'open') as open
      FROM compliance_violations
      WHERE detected_at >= $1 AND detected_at <= $2
      GROUP BY violation_type, severity
      ORDER BY count DESC
    `;

    const violationsResult = await client.query(violationsQuery, [config.startDate, config.endDate]);
    compliance.violations = violationsResult.rows;

    // Data retention compliance
    const retentionQuery = `
      SELECT 
        COUNT(*) as total_records,
        COUNT(*) FILTER (WHERE retention_until < NOW()) as expired_records,
        COUNT(*) FILTER (WHERE retention_until > NOW()) as active_records,
        MIN(retention_until) as earliest_expiry,
        MAX(retention_until) as latest_expiry
      FROM audit_logs
      WHERE created_at >= $1 AND created_at <= $2
    `;

    const retentionResult = await client.query(retentionQuery, [config.startDate, config.endDate]);
    compliance.dataRetention = retentionResult.rows[0];

    return compliance;
  }

  /**
   * Collect performance metrics
   */
  async collectPerformanceMetrics(client, config) {
    const performance = {};

    // Response time analysis
    const responseTimeQuery = `
      SELECT 
        COUNT(*) as total_requests,
        ROUND(AVG(response_time_ms)::numeric, 0) as avg_response_time,
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY response_time_ms)::numeric, 0) as median_response_time,
        ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms)::numeric, 0) as p95_response_time,
        ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY response_time_ms)::numeric, 0) as p99_response_time,
        MIN(response_time_ms) as min_response_time,
        MAX(response_time_ms) as max_response_time
      FROM audit_logs
      WHERE created_at >= $1 AND created_at <= $2
      AND response_time_ms > 0
    `;

    const responseTimeResult = await client.query(responseTimeQuery, [config.startDate, config.endDate]);
    performance.responseTime = responseTimeResult.rows[0];

    // Confidence score analysis
    const confidenceQuery = `
      SELECT 
        COUNT(*) as total_responses,
        ROUND(AVG(confidence_score)::numeric, 3) as avg_confidence,
        COUNT(*) FILTER (WHERE confidence_score >= 0.8) as high_confidence,
        COUNT(*) FILTER (WHERE confidence_score >= 0.6 AND confidence_score < 0.8) as medium_confidence,
        COUNT(*) FILTER (WHERE confidence_score < 0.6) as low_confidence,
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY confidence_score)::numeric, 3) as median_confidence
      FROM audit_logs
      WHERE created_at >= $1 AND created_at <= $2
      AND confidence_score IS NOT NULL
    `;

    const confidenceResult = await client.query(confidenceQuery, [config.startDate, config.endDate]);
    performance.confidence = confidenceResult.rows[0];

    // Error analysis
    const errorQuery = `
      SELECT 
        severity,
        category,
        COUNT(*) as error_count,
        COUNT(*) FILTER (WHERE resolved = TRUE) as resolved_count
      FROM audit_errors
      WHERE created_at >= $1 AND created_at <= $2
      GROUP BY severity, category
      ORDER BY error_count DESC
    `;

    const errorResult = await client.query(errorQuery, [config.startDate, config.endDate]);
    performance.errors = errorResult.rows;

    return performance;
  }

  /**
   * Collect security metrics
   */
  async collectSecurityMetrics(client, config) {
    const security = {};

    // Admin access analysis
    const adminAccessQuery = `
      SELECT 
        COUNT(*) as total_access_events,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(*) FILTER (WHERE success = FALSE) as failed_attempts,
        COUNT(*) FILTER (WHERE data_exported = TRUE) as data_exports,
        jsonb_object_agg(action, action_count) as action_breakdown
      FROM (
        SELECT 
          user_id, success, data_exported, action,
          COUNT(*) as action_count
        FROM admin_access_logs
        WHERE created_at >= $1 AND created_at <= $2
        GROUP BY user_id, success, data_exported, action
      ) access_data
    `;

    const adminAccessResult = await client.query(adminAccessQuery, [config.startDate, config.endDate]);
    security.adminAccess = adminAccessResult.rows[0] || {
      total_access_events: 0,
      unique_users: 0,
      failed_attempts: 0,
      data_exports: 0,
      action_breakdown: {},
    };

    // Session security analysis
    const sessionSecurityQuery = `
      SELECT 
        COUNT(*) as total_sessions,
        AVG(total_interactions) as avg_interactions_per_session,
        COUNT(*) FILTER (WHERE pii_detections > 0) as sessions_with_pii,
        COUNT(*) FILTER (WHERE compliance_violations > 0) as sessions_with_violations,
        MAX(total_interactions) as max_interactions_per_session
      FROM audit_session_stats
      WHERE created_at >= $1 AND created_at <= $2
    `;

    const sessionSecurityResult = await client.query(sessionSecurityQuery, [config.startDate, config.endDate]);
    security.sessionAnalysis = sessionSecurityResult.rows[0];

    return security;
  }

  /**
   * Collect trend analysis
   */
  async collectTrendAnalysis(client, config) {
    const trends = {};

    // Calculate comparison period (same duration, previous period)
    const periodDuration = new Date(config.endDate) - new Date(config.startDate);
    const comparisonStartDate = new Date(new Date(config.startDate) - periodDuration);
    const comparisonEndDate = new Date(config.startDate);

    // Compare current vs previous period
    const trendQuery = `
      WITH current_period AS (
        SELECT 
          COUNT(*) as interactions,
          AVG(confidence_score) as avg_confidence,
          AVG(response_time_ms) as avg_response_time,
          COUNT(*) FILTER (WHERE pii_detected = TRUE) as pii_detections
        FROM audit_logs
        WHERE created_at >= $1 AND created_at <= $2
      ),
      previous_period AS (
        SELECT 
          COUNT(*) as interactions,
          AVG(confidence_score) as avg_confidence,
          AVG(response_time_ms) as avg_response_time,
          COUNT(*) FILTER (WHERE pii_detected = TRUE) as pii_detections
        FROM audit_logs
        WHERE created_at >= $3 AND created_at <= $4
      )
      SELECT 
        c.interactions as current_interactions,
        p.interactions as previous_interactions,
        CASE 
          WHEN p.interactions > 0 THEN ROUND(((c.interactions - p.interactions)::numeric / p.interactions * 100), 2)
          ELSE 0
        END as interactions_change_percent,
        c.avg_confidence as current_confidence,
        p.avg_confidence as previous_confidence,
        ROUND((c.avg_confidence - p.avg_confidence)::numeric, 3) as confidence_change,
        c.avg_response_time as current_response_time,
        p.avg_response_time as previous_response_time,
        ROUND((c.avg_response_time - p.avg_response_time)::numeric, 0) as response_time_change,
        c.pii_detections as current_pii,
        p.pii_detections as previous_pii
      FROM current_period c, previous_period p
    `;

    const trendResult = await client.query(trendQuery, [
      config.startDate, config.endDate,
      comparisonStartDate.toISOString(), comparisonEndDate.toISOString()
    ]);
    
    trends.periodComparison = trendResult.rows[0];

    return trends;
  }

  /**
   * Generate recommendations based on report data
   */
  async generateRecommendations(reportData) {
    const recommendations = [];

    // Performance recommendations
    if (reportData.performance.responseTime?.avg_response_time > 3000) {
      recommendations.push({
        category: 'performance',
        priority: 'high',
        title: 'High Response Times Detected',
        description: `Average response time is ${Math.round(reportData.performance.responseTime.avg_response_time)}ms, which exceeds the 3-second target.`,
        recommendation: 'Review system performance, optimize database queries, and consider scaling infrastructure.',
        impact: 'User experience degradation',
      });
    }

    // Confidence recommendations
    if (reportData.performance.confidence?.avg_confidence < 0.7) {
      recommendations.push({
        category: 'quality',
        priority: 'medium',
        title: 'Low Confidence Scores',
        description: `Average confidence score is ${reportData.performance.confidence.avg_confidence}, below the recommended 0.7 threshold.`,
        recommendation: 'Review retrieval strategies, update knowledge base content, and refine prompting templates.',
        impact: 'Answer quality and reliability concerns',
      });
    }

    // PII recommendations
    if (reportData.compliance.piiAnalysis?.total_pii_detections > 0) {
      recommendations.push({
        category: 'compliance',
        priority: 'high',
        title: 'PII Detections Require Attention',
        description: `${reportData.compliance.piiAnalysis.total_pii_detections} PII detections found across ${reportData.compliance.piiAnalysis.sessions_with_pii} sessions.`,
        recommendation: 'Review PII detection accuracy, enhance user training on data privacy, and audit redaction processes.',
        impact: 'Regulatory compliance and privacy risks',
      });
    }

    // Compliance violations
    if (reportData.compliance.violations?.length > 0) {
      const openViolations = reportData.compliance.violations.reduce((sum, v) => sum + v.open, 0);
      if (openViolations > 0) {
        recommendations.push({
          category: 'compliance',
          priority: 'critical',
          title: 'Open Compliance Violations',
          description: `${openViolations} compliance violations remain unresolved.`,
          recommendation: 'Immediately investigate and resolve open violations. Implement preventive measures.',
          impact: 'Regulatory and legal risks',
        });
      }
    }

    // Usage pattern recommendations
    if (reportData.trends?.periodComparison?.interactions_change_percent > 50) {
      recommendations.push({
        category: 'capacity',
        priority: 'medium',
        title: 'Significant Usage Increase',
        description: `Usage increased by ${reportData.trends.periodComparison.interactions_change_percent}% compared to previous period.`,
        recommendation: 'Monitor system capacity and consider scaling infrastructure to handle increased load.',
        impact: 'System stability and performance',
      });
    }

    return recommendations;
  }

  /**
   * Generate formatted report content
   */
  async generateReportContent(reportData, config) {
    const content = {
      ...reportData,
      formattedSections: {
        executiveSummary: this.generateExecutiveSummary(reportData),
        detailedAnalysis: this.generateDetailedAnalysis(reportData),
        complianceSection: this.generateComplianceSection(reportData),
        performanceSection: this.generatePerformanceSection(reportData),
        recommendationsSection: this.generateRecommendationsSection(reportData),
        appendices: this.generateAppendices(reportData),
      },
    };

    return content;
  }

  /**
   * Generate executive summary
   */
  generateExecutiveSummary(data) {
    const summary = data.summary;
    const period = `${new Date(data.metadata.periodStart).toLocaleDateString()} to ${new Date(data.metadata.periodEnd).toLocaleDateString()}`;
    
    return {
      title: `Executive Summary - ${data.metadata.reportType}`,
      period,
      keyMetrics: [
        { label: 'Total Interactions', value: summary.total_interactions?.toLocaleString() || '0' },
        { label: 'Unique Sessions', value: summary.unique_sessions?.toLocaleString() || '0' },
        { label: 'Average Confidence', value: `${Math.round((summary.avg_confidence || 0) * 100)}%` },
        { label: 'Average Response Time', value: `${Math.round(summary.avg_response_time || 0)}ms` },
        { label: 'PII Detections', value: summary.pii_detections?.toLocaleString() || '0' },
        { label: 'Compliance Violations', value: summary.compliance_violations?.toLocaleString() || '0' },
      ],
      overview: this.generateOverviewText(data),
    };
  }

  /**
   * Generate overview text
   */
  generateOverviewText(data) {
    const summary = data.summary;
    const totalInteractions = summary.total_interactions || 0;
    const avgConfidence = Math.round((summary.avg_confidence || 0) * 100);
    const avgResponseTime = Math.round(summary.avg_response_time || 0);
    const piiDetections = summary.pii_detections || 0;
    const violations = summary.compliance_violations || 0;

    let overview = `During the reporting period, the system processed ${totalInteractions.toLocaleString()} interactions across ${summary.unique_sessions?.toLocaleString() || '0'} unique sessions. `;
    
    if (avgConfidence >= 80) {
      overview += `The system maintained high quality responses with an average confidence score of ${avgConfidence}%. `;
    } else if (avgConfidence >= 60) {
      overview += `The system achieved moderate quality responses with an average confidence score of ${avgConfidence}%. `;
    } else {
      overview += `The system's response quality requires attention with an average confidence score of ${avgConfidence}%. `;
    }

    if (avgResponseTime <= 3000) {
      overview += `Performance was within acceptable limits with an average response time of ${avgResponseTime}ms. `;
    } else {
      overview += `Performance exceeded target thresholds with an average response time of ${avgResponseTime}ms. `;
    }

    if (piiDetections === 0) {
      overview += 'No PII was detected in user interactions. ';
    } else {
      overview += `PII was detected in ${piiDetections} interactions, all of which were properly redacted. `;
    }

    if (violations === 0) {
      overview += 'No compliance violations were identified during this period.';
    } else {
      overview += `${violations} compliance violations were identified and require attention.`;
    }

    return overview;
  }

  /**
   * Generate detailed analysis section
   */
  generateDetailedAnalysis(data) {
    return {
      title: 'Detailed Analysis',
      dailyTrends: {
        title: 'Daily Interaction Trends',
        data: data.details.dailyBreakdown || [],
        summary: this.analyzeDailyTrends(data.details.dailyBreakdown || []),
      },
      categoryAnalysis: {
        title: 'Category Performance Analysis',
        data: data.details.categoryBreakdown || [],
        summary: this.analyzeCategoryPerformance(data.details.categoryBreakdown || []),
      },
      modelPerformance: {
        title: 'Model Performance Analysis',
        data: data.details.modelBreakdown || [],
        summary: this.analyzeModelPerformance(data.details.modelBreakdown || []),
      },
    };
  }

  /**
   * Store report in database
   */
  async storeReport(reportContent, config) {
    const client = await this.pool.connect();
    
    try {
      const query = `
        INSERT INTO compliance_reports (
          report_type, report_period_start, report_period_end,
          report_data, report_summary, generated_by, generation_time,
          total_records, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `;

      const values = [
        config.type,
        config.startDate,
        config.endDate,
        JSON.stringify(reportContent),
        reportContent.formattedSections.executiveSummary.overview,
        config.generatedBy || 'system',
        Date.now(),
        reportContent.summary.total_interactions || 0,
        'generated',
      ];

      const result = await client.query(query, values);
      return result.rows[0].id;

    } finally {
      client.release();
    }
  }

  /**
   * Export report to various formats
   */
  async exportReport(reportContent, format, reportId) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `compliance_report_${reportId}_${timestamp}`;
    const outputDir = path.join(process.cwd(), 'reports', 'compliance');
    
    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    switch (format.toLowerCase()) {
      case 'pdf':
        return await this.exportToPDF(reportContent, path.join(outputDir, `${filename}.pdf`));
      case 'excel':
        return await this.exportToExcel(reportContent, path.join(outputDir, `${filename}.xlsx`));
      case 'json':
        return await this.exportToJSON(reportContent, path.join(outputDir, `${filename}.json`));
      case 'csv':
        return await this.exportToCSV(reportContent, path.join(outputDir, `${filename}.csv`));
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Export to PDF format
   */
  async exportToPDF(reportContent, filePath) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        // Title page
        doc.fontSize(24).text('Compliance Report', { align: 'center' });
        doc.fontSize(16).text(reportContent.metadata.reportType, { align: 'center' });
        doc.fontSize(12).text(`Period: ${reportContent.metadata.periodStart} to ${reportContent.metadata.periodEnd}`, { align: 'center' });
        doc.fontSize(10).text(`Generated: ${new Date(reportContent.metadata.generatedAt).toLocaleString()}`, { align: 'center' });
        
        doc.addPage();

        // Executive Summary
        doc.fontSize(18).text('Executive Summary', { underline: true });
        doc.fontSize(12).text(reportContent.formattedSections.executiveSummary.overview, { align: 'justify' });
        
        doc.moveDown();
        doc.fontSize(14).text('Key Metrics:', { underline: true });
        reportContent.formattedSections.executiveSummary.keyMetrics.forEach(metric => {
          doc.fontSize(11).text(`• ${metric.label}: ${metric.value}`);
        });

        // Recommendations
        if (reportContent.recommendations && reportContent.recommendations.length > 0) {
          doc.addPage();
          doc.fontSize(18).text('Recommendations', { underline: true });
          
          reportContent.recommendations.forEach((rec, index) => {
            doc.fontSize(14).text(`${index + 1}. ${rec.title}`, { underline: true });
            doc.fontSize(11).text(`Priority: ${rec.priority.toUpperCase()}`);
            doc.fontSize(11).text(`Category: ${rec.category}`);
            doc.fontSize(11).text(`Description: ${rec.description}`);
            doc.fontSize(11).text(`Recommendation: ${rec.recommendation}`);
            doc.fontSize(11).text(`Impact: ${rec.impact}`);
            doc.moveDown();
          });
        }

        doc.end();
        
        stream.on('finish', () => resolve(filePath));
        stream.on('error', reject);

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Export to Excel format
   */
  async exportToExcel(reportContent, filePath) {
    const workbook = new ExcelJS.Workbook();
    
    // Summary sheet
    const summarySheet = workbook.addWorksheet('Executive Summary');
    summarySheet.addRow(['Compliance Report - Executive Summary']);
    summarySheet.addRow([]);
    summarySheet.addRow(['Report Type:', reportContent.metadata.reportType]);
    summarySheet.addRow(['Period:', `${reportContent.metadata.periodStart} to ${reportContent.metadata.periodEnd}`]);
    summarySheet.addRow(['Generated:', new Date(reportContent.metadata.generatedAt).toLocaleString()]);
    summarySheet.addRow([]);
    
    summarySheet.addRow(['Key Metrics']);
    summarySheet.addRow(['Metric', 'Value']);
    reportContent.formattedSections.executiveSummary.keyMetrics.forEach(metric => {
      summarySheet.addRow([metric.label, metric.value]);
    });

    // Daily breakdown sheet
    if (reportContent.details.dailyBreakdown) {
      const dailySheet = workbook.addWorksheet('Daily Breakdown');
      dailySheet.addRow(['Date', 'Interactions', 'Sessions', 'Avg Confidence', 'Avg Response Time', 'PII Detections']);
      
      reportContent.details.dailyBreakdown.forEach(day => {
        dailySheet.addRow([
          day.interaction_date,
          day.interactions,
          day.sessions,
          day.avg_confidence,
          day.avg_response_time,
          day.pii_detections,
        ]);
      });
    }

    // Recommendations sheet
    if (reportContent.recommendations && reportContent.recommendations.length > 0) {
      const recSheet = workbook.addWorksheet('Recommendations');
      recSheet.addRow(['Priority', 'Category', 'Title', 'Description', 'Recommendation', 'Impact']);
      
      reportContent.recommendations.forEach(rec => {
        recSheet.addRow([
          rec.priority,
          rec.category,
          rec.title,
          rec.description,
          rec.recommendation,
          rec.impact,
        ]);
      });
    }

    await workbook.xlsx.writeFile(filePath);
    return filePath;
  }

  /**
   * Export to JSON format
   */
  async exportToJSON(reportContent, filePath) {
    await fs.writeFile(filePath, JSON.stringify(reportContent, null, 2), 'utf8');
    return filePath;
  }

  /**
   * Export to CSV format
   */
  async exportToCSV(reportContent, filePath) {
    let csvContent = 'Compliance Report Summary\n';
    csvContent += `Report Type,${reportContent.metadata.reportType}\n`;
    csvContent += `Period,${reportContent.metadata.periodStart} to ${reportContent.metadata.periodEnd}\n`;
    csvContent += `Generated,${new Date(reportContent.metadata.generatedAt).toLocaleString()}\n\n`;
    
    csvContent += 'Key Metrics\n';
    csvContent += 'Metric,Value\n';
    reportContent.formattedSections.executiveSummary.keyMetrics.forEach(metric => {
      csvContent += `"${metric.label}","${metric.value}"\n`;
    });

    if (reportContent.details.dailyBreakdown) {
      csvContent += '\nDaily Breakdown\n';
      csvContent += 'Date,Interactions,Sessions,Avg Confidence,Avg Response Time,PII Detections\n';
      reportContent.details.dailyBreakdown.forEach(day => {
        csvContent += `${day.interaction_date},${day.interactions},${day.sessions},${day.avg_confidence},${day.avg_response_time},${day.pii_detections}\n`;
      });
    }

    await fs.writeFile(filePath, csvContent, 'utf8');
    return filePath;
  }

  /**
   * Validate report configuration
   */
  validateReportConfig(config) {
    const required = ['type', 'startDate', 'endDate'];
    
    for (const field of required) {
      if (!config[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (!this.reportTypes[config.type]) {
      throw new Error(`Invalid report type: ${config.type}`);
    }

    const startDate = new Date(config.startDate);
    const endDate = new Date(config.endDate);
    
    if (startDate >= endDate) {
      throw new Error('Start date must be before end date');
    }

    if (endDate > new Date()) {
      throw new Error('End date cannot be in the future');
    }
  }

  /**
   * Get available report types
   */
  getReportTypes() {
    return this.reportTypes;
  }

  /**
   * Schedule automated report generation
   */
  async scheduleReport(reportConfig, schedule) {
    // Implementation would depend on your job scheduling system
    // This is a placeholder for the interface
    logger.info('Report scheduled', { config: reportConfig, schedule });
    
    return {
      scheduleId: `schedule_${Date.now()}`,
      reportConfig,
      schedule,
      status: 'scheduled',
    };
  }

  /**
   * Analyze daily trends
   */
  analyzeDailyTrends(dailyData) {
    if (!dailyData || dailyData.length === 0) {
      return 'No daily data available for analysis.';
    }

    const totalDays = dailyData.length;
    const avgInteractions = dailyData.reduce((sum, day) => sum + day.interactions, 0) / totalDays;
    const peakDay = dailyData.reduce((max, day) => day.interactions > max.interactions ? day : max);
    
    return `Over ${totalDays} days, the system averaged ${Math.round(avgInteractions)} interactions per day. Peak usage occurred on ${peakDay.interaction_date} with ${peakDay.interactions} interactions.`;
  }

  /**
   * Analyze category performance
   */
  analyzeCategoryPerformance(categoryData) {
    if (!categoryData || categoryData.length === 0) {
      return 'No category data available for analysis.';
    }

    const topCategory = categoryData[0];
    const totalInteractions = categoryData.reduce((sum, cat) => sum + cat.interactions, 0);
    const topPercentage = Math.round((topCategory.interactions / totalInteractions) * 100);
    
    return `The most active category was "${topCategory.category}" with ${topCategory.interactions} interactions (${topPercentage}% of total). Average confidence for this category was ${Math.round(topCategory.avg_confidence * 100)}%.`;
  }

  /**
   * Analyze model performance
   */
  analyzeModelPerformance(modelData) {
    if (!modelData || modelData.length === 0) {
      return 'No model performance data available for analysis.';
    }

    const primaryModel = modelData[0];
    const avgConfidence = Math.round(primaryModel.avg_confidence * 100);
    const avgResponseTime = Math.round(primaryModel.avg_response_time);
    
    return `Primary model "${primaryModel.model_version}" handled ${primaryModel.interactions} interactions with ${avgConfidence}% average confidence and ${avgResponseTime}ms average response time.`;
  }

  /**
   * Generate compliance section
   */
  generateComplianceSection(data) {
    return {
      title: 'Compliance Analysis',
      piiAnalysis: data.compliance.piiAnalysis,
      violations: data.compliance.violations,
      dataRetention: data.compliance.dataRetention,
      summary: this.generateComplianceSummary(data.compliance),
    };
  }

  /**
   * Generate performance section
   */
  generatePerformanceSection(data) {
    return {
      title: 'Performance Analysis',
      responseTime: data.performance.responseTime,
      confidence: data.performance.confidence,
      errors: data.performance.errors,
      summary: this.generatePerformanceSummary(data.performance),
    };
  }

  /**
   * Generate recommendations section
   */
  generateRecommendationsSection(data) {
    return {
      title: 'Recommendations',
      recommendations: data.recommendations || [],
      summary: `${(data.recommendations || []).length} recommendations identified for system improvement.`,
    };
  }

  /**
   * Generate appendices
   */
  generateAppendices(data) {
    return {
      title: 'Appendices',
      rawData: {
        summary: data.summary,
        trends: data.trends,
      },
      methodology: 'This report was generated using automated analysis of audit log data. All PII has been redacted in accordance with privacy policies.',
    };
  }

  /**
   * Generate compliance summary
   */
  generateComplianceSummary(compliance) {
    const piiCount = compliance.piiAnalysis?.total_pii_detections || 0;
    const violationCount = compliance.violations?.length || 0;
    
    let summary = '';
    
    if (piiCount === 0 && violationCount === 0) {
      summary = 'Excellent compliance posture with no PII detections or violations identified.';
    } else if (piiCount > 0 && violationCount === 0) {
      summary = `${piiCount} PII detections were properly handled with no compliance violations.`;
    } else {
      summary = `${violationCount} compliance violations require attention. ${piiCount} PII detections were processed.`;
    }
    
    return summary;
  }

  /**
   * Generate performance summary
   */
  generatePerformanceSummary(performance) {
    const avgResponseTime = Math.round(performance.responseTime?.avg_response_time || 0);
    const avgConfidence = Math.round((performance.confidence?.avg_confidence || 0) * 100);
    
    let summary = `System performance: ${avgResponseTime}ms average response time, ${avgConfidence}% average confidence. `;
    
    if (avgResponseTime <= 3000 && avgConfidence >= 80) {
      summary += 'Performance targets met successfully.';
    } else if (avgResponseTime > 3000) {
      summary += 'Response time exceeds target thresholds.';
    } else if (avgConfidence < 80) {
      summary += 'Confidence scores below target levels.';
    }
    
    return summary;
  }

  /**
   * Close database connections
   */
  async close() {
    await this.pool.end();
  }
}

module.exports = ComplianceReportGenerator;
