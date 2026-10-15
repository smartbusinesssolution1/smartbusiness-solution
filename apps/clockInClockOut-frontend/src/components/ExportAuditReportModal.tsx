import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Box,
  Button,
  Radio,
  Paper,
  CircularProgress,
  IconButton,
  Chip,
  Alert,
} from '@mui/material';
import {
  Close as CloseIcon,
  TableChart as ExcelIcon,
  Description as CsvIcon,
  PictureAsPdf as PdfIcon,
  FileDownload as DownloadIcon,
  CheckCircle as SuccessIcon,
} from '@mui/icons-material';
import { attendanceService, ExportReportParams } from '../services/attendanceService';
import { CLOCKIN_API_URL } from '../services/apiClient';

export interface ExportAuditReportModalProps {
  open: boolean;
  onClose: () => void;
  currentFilters: {
    search?: string;
    status?: string;
    date?: string;
    workspaceId?: string;
  };
  totalCount: number;
}

type ExportFormat = 'xlsx' | 'csv' | 'pdf';

interface FormatOption {
  id: ExportFormat;
  title: string;
  extension: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
}

const FORMAT_OPTIONS: FormatOption[] = [
  {
    id: 'xlsx',
    title: 'Microsoft Excel',
    extension: '.xlsx',
    description: 'Formatted workbook with headers, auto-width columns, and shift summary statistics.',
    icon: <ExcelIcon sx={{ fontSize: 28, color: '#16A34A' }} />,
    color: '#16A34A',
    bgColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  {
    id: 'csv',
    title: 'Comma Separated Values',
    extension: '.csv',
    description: 'Universal raw tabular dataset with UTF-8 BOM, compatible with Google Sheets & BI tools.',
    icon: <CsvIcon sx={{ fontSize: 28, color: '#2563EB' }} />,
    color: '#2563EB',
    bgColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  {
    id: 'pdf',
    title: 'Portable Document Format',
    extension: '.pdf',
    description: 'Executive landscape document styled for printing, corporate compliance, and archiving.',
    icon: <PdfIcon sx={{ fontSize: 28, color: '#DC2626' }} />,
    color: '#DC2626',
    bgColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
];

export const ExportAuditReportModal: React.FC<ExportAuditReportModalProps> = ({
  open,
  onClose,
  currentFilters,
  totalCount,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('xlsx');
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ filename: string; totalRecords: number } | null>(null);

  const handleClose = () => {
    if (isExporting) return;
    setError(null);
    setSuccessInfo(null);
    onClose();
  };

  const handleDownload = async () => {
    setError(null);
    setSuccessInfo(null);
    setIsExporting(true);

    try {
      const payload: ExportReportParams = {
        format: selectedFormat,
        search: currentFilters.search || undefined,
        status: currentFilters.status && currentFilters.status !== 'all' ? currentFilters.status : undefined,
        date: currentFilters.date || undefined,
        workspaceId: currentFilters.workspaceId || undefined,
      };

      const result = await attendanceService.exportAuditReport(payload);

      // Trigger automatic file download
      let fileUrl = result.downloadUrl;
      if (fileUrl.startsWith('/')) {
        fileUrl = `${CLOCKIN_API_URL}${fileUrl}`;
      }

      const link = document.createElement('a');
      link.href = fileUrl;
      link.setAttribute('download', result.filename);
      link.setAttribute('target', '_blank');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setSuccessInfo({
        filename: result.filename,
        totalRecords: result.totalRecords,
      });

      // Auto-close after brief confirmation
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err: any) {
      console.error('Export report error:', err);
      setError(err?.response?.data?.error?.message || err?.message || 'Failed to generate report file.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 3,
            p: 1,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pb: 1,
        }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            Export Audit Report
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Select your preferred file format to download the attendance audit records.
          </Typography>
        </Box>
        <IconButton size="small" onClick={handleClose} disabled={isExporting}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1.5 }}>
        {/* Active Criteria Scope Info */}
        <Box
          sx={{
            mb: 2.5,
            p: 1.5,
            borderRadius: 2,
            bgcolor: 'action.hover',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
            Export Scope:
          </Typography>
          <Chip label={`All Matching Logs (${totalCount} Records)`} size="small" color="primary" sx={{ fontWeight: 600 }} />
          {currentFilters.status && currentFilters.status !== 'all' && (
            <Chip label={`Status: ${currentFilters.status.toUpperCase()}`} size="small" variant="outlined" />
          )}
          {currentFilters.date && (
            <Chip label={`Date: ${currentFilters.date}`} size="small" variant="outlined" />
          )}
          {currentFilters.search && (
            <Chip label={`Search: "${currentFilters.search}"`} size="small" variant="outlined" />
          )}
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
            {error}
          </Alert>
        )}

        {successInfo && (
          <Alert severity="success" icon={<SuccessIcon />} sx={{ mb: 2, borderRadius: 2 }}>
            Report generated successfully! ({successInfo.totalRecords} records) Downloading <strong>{successInfo.filename}</strong>...
          </Alert>
        )}

        {/* Format Options Cards */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {FORMAT_OPTIONS.map((opt) => {
            const isSelected = selectedFormat === opt.id;
            return (
              <Paper
                key={opt.id}
                variant="outlined"
                onClick={() => !isExporting && setSelectedFormat(opt.id)}
                sx={{
                  p: 2,
                  borderRadius: 2.5,
                  cursor: isExporting ? 'default' : 'pointer',
                  border: isSelected ? `2px solid ${opt.color}` : '1px solid',
                  borderColor: isSelected ? opt.color : 'divider',
                  bgcolor: isSelected ? opt.bgColor : 'background.paper',
                  transition: 'all 0.15s ease-in-out',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  '&:hover': {
                    borderColor: opt.color,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  },
                }}
              >
                <Radio
                  checked={isSelected}
                  value={opt.id}
                  disabled={isExporting}
                  sx={{
                    color: opt.color,
                    '&.Mui-checked': { color: opt.color },
                    p: 0.5,
                  }}
                />

                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: '#FFFFFF',
                    border: `1px solid ${opt.borderColor}`,
                    flexShrink: 0,
                  }}
                >
                  {opt.icon}
                </Box>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                      {opt.title}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 700,
                        color: opt.color,
                        bgcolor: '#FFFFFF',
                        px: 0.75,
                        py: 0.1,
                        borderRadius: 1,
                        border: `1px solid ${opt.borderColor}`,
                      }}
                    >
                      {opt.extension}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                    {opt.description}
                  </Typography>
                </Box>
              </Paper>
            );
          })}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, justifyContent: 'space-between' }}>
        <Button onClick={handleClose} disabled={isExporting} color="inherit" sx={{ textTransform: 'none', fontWeight: 600 }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleDownload}
          disabled={isExporting}
          startIcon={isExporting ? <CircularProgress size={18} color="inherit" /> : <DownloadIcon />}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            borderRadius: 2,
            px: 2.5,
            py: 1,
          }}
        >
          {isExporting ? 'Generating Report...' : `Download ${selectedFormat.toUpperCase()} File`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ExportAuditReportModal;
