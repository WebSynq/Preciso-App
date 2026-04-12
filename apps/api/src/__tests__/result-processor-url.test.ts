/**
 * Unit tests for the reportUrl validation logic in result-processor.
 *
 * We extract and test the validation rules directly to verify XSS-prevention
 * without needing a real Supabase connection.
 */

// Replicate the validation logic from result-processor.ts so we can unit-test
// it without mocking the entire module's Supabase dependency.
const ALLOWED_REPORT_HOSTS = new Set([
  'results.cenegenics.com',
  'portal.cenegenics.com',
  'api.sampled.com',
  'results.sampled.com',
]);

function validateReportUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  if (!ALLOWED_REPORT_HOSTS.has(parsed.hostname)) return null;
  return parsed.toString();
}

describe('validateReportUrl', () => {
  it('accepts a valid https URL on an allowlisted host', () => {
    const url = 'https://results.cenegenics.com/report/abc123';
    expect(validateReportUrl(url)).toBe(url);
  });

  it('accepts all allowlisted hosts', () => {
    for (const host of ALLOWED_REPORT_HOSTS) {
      expect(validateReportUrl(`https://${host}/path`)).toContain(host);
    }
  });

  it('rejects javascript: URLs (XSS vector)', () => {
    expect(validateReportUrl('javascript:alert(1)')).toBeNull();
  });

  it('rejects data: URLs', () => {
    expect(validateReportUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
  });

  it('rejects http:// URLs', () => {
    expect(validateReportUrl('http://results.cenegenics.com/report')).toBeNull();
  });

  it('rejects URLs from non-allowlisted hosts', () => {
    expect(validateReportUrl('https://evil.com/malware')).toBeNull();
    expect(validateReportUrl('https://cenegenics.com.evil.com/x')).toBeNull();
  });

  it('rejects empty string', () => {
    expect(validateReportUrl('')).toBeNull();
  });

  it('rejects undefined', () => {
    expect(validateReportUrl(undefined)).toBeNull();
  });

  it('rejects malformed URLs', () => {
    expect(validateReportUrl('not a url')).toBeNull();
    expect(validateReportUrl('://broken')).toBeNull();
  });
});
