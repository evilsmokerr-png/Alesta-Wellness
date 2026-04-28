import * as XLSX from 'xlsx';
import { format } from 'date-fns';

export const exportToExcel = (sheets: { data: any[], name: string }[], fileName: string) => {
  const workbook = XLSX.utils.book_new();
  
  sheets.forEach(sheet => {
    if (sheet.data.length > 0 || sheet.name === 'Clinical Records') {
      const worksheet = XLSX.utils.json_to_sheet(sheet.data);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
      
      // Auto-width columns
      const max_width = sheet.data.reduce((w, r) => Math.max(w, ...Object.values(r).map(v => String(v).length)), 10);
      worksheet['!cols'] = [{ wch: Math.min(max_width, 50) }];
    }
  });

  XLSX.writeFile(workbook, `${fileName}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
};

export const prepareTreatmentDataForExport = (treatments: any[], clientDataMap: Record<string, any>) => {
  return treatments.map(t => {
    const client = clientDataMap[t.parentId || ''] || {};
    let dateStr = 'N/A';
    let followUpStr = 'N/A';
    
    try {
      if (t.date?.toDate) {
        dateStr = format(t.date.toDate(), 'yyyy-MM-dd HH:mm');
      } else if (t.date instanceof Date) {
        dateStr = format(t.date, 'yyyy-MM-dd HH:mm');
      } else if (typeof t.date === 'string' || typeof t.date === 'number') {
        dateStr = format(new Date(t.date), 'yyyy-MM-dd HH:mm');
      }

      if (t.followUpDate?.toDate) {
        followUpStr = format(t.followUpDate.toDate(), 'yyyy-MM-dd');
      } else if (t.followUpDate instanceof Date) {
        followUpStr = format(t.followUpDate, 'yyyy-MM-dd');
      } else if (t.followUpDate && (typeof t.followUpDate === 'string' || typeof t.followUpDate === 'number')) {
        followUpStr = format(new Date(t.followUpDate), 'yyyy-MM-dd');
      }
    } catch (e) {
      console.warn("Date formatting error for export", e);
    }

    return {
      'Date': dateStr,
      'Patient Name': t.clientName || client.name || 'Unknown',
      'Phone': t.clientPhone || client.phone || 'N/A',
      'Clinical Record': t.treatmentName || 'N/A',
      'Intensity/Parameters': t.productUsage || 'N/A',
      'Follow-up Date': followUpStr,
      'Doctor/Consultant': t.doctorName || 'N/A',
      'Service Charges': t.serviceCharges || 0,
      'Discount': t.discountAmount || 0,
      'Final Amount': t.finalAmount || 0,
      'Payment Status': t.paymentStatus || 'Pending',
      'Payment Mode': t.paymentMethod || t.paymentMethods?.join(', ') || 'N/A',
      'Notes': t.notes || ''
    };
  });
};

export const prepareLeadDataForExport = (leads: any[]) => {
  return leads.map(l => {
    let createdAt = 'N/A';
    try {
      if (l.createdAt?.toDate) {
        createdAt = format(l.createdAt.toDate(), 'yyyy-MM-dd HH:mm');
      } else if (l.createdAt) {
        createdAt = format(new Date(l.createdAt), 'yyyy-MM-dd HH:mm');
      }
    } catch (e) {}

    return {
      'Date Created': createdAt,
      'Lead Name': l.name || 'N/A',
      'Phone': l.phone || 'N/A',
      'Source': l.source || 'N/A',
      'Requirement': l.requirement || 'N/A',
      'Status': l.status || 'N/A',
      'Last Follow up': l.lastFollowUp || 'N/A',
      'Notes': l.notes || ''
    };
  });
};
