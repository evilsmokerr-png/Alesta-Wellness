import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { Upload, X, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Client } from '../types';
import { addDays, format as formatDateFns } from 'date-fns';

interface BulkClientImportProps {
  userId: string;
  onClose: () => void;
  onComplete: () => void;
}

export default function BulkClientImport({ userId, onClose, onComplete }: BulkClientImportProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<{ success: number; skipped: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const template = [
      {
        'Patient Name': 'John Doe',
        'Phone Number': '9876543210',
        'Address': '123 Health St, City',
        'Source': 'Google',
        'Concern': 'Wellness checkup',
        'Treatment Name': 'Laser Resurfacing',
        'Intensity': '30J / Hydro-Gel',
        'Treatment Date': formatDateFns(new Date(), 'yyyy-MM-dd'),
        'Follow-up Days': '7',
        'Doctor Name': 'Dr. Sweta'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'patient_and_treatment_import_template.xlsx');
  };

  const processFile = async (file: File) => {
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);

      if (jsonData.length === 0) {
        throw new Error('The excel file is empty.');
      }

      const total = jsonData.length;
      setProgress({ current: 0, total });

      let success = 0;
      let skipped = 0;
      const errorsList: string[] = [];

      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        const name = row['Patient Name'] || row['Name'];
        const phone = String(row['Phone Number'] || row['Phone'] || '').replace(/\D/g, '');
        const address = row['Address'] || row['Location'] || '';
        const source = row['Source'] || '';
        const concern = row['Concern'] || '';
        
        // Treatment Fields
        const tName = row['Treatment Name'] || row['Treatment'] || '';
        const tIntensity = row['Intensity'] || row['Intensity / Level'] || row['Intensity/Level'] || row['Intensity/Parameters'] || '';
        const tDateRaw = row['Treatment Date'] || row['Date'] || '';
        const tFollowUpDays = parseInt(row['Follow-up Days'] || row['Follow up Days'] || '0') || 0;
        const tDoctor = row['Doctor Name'] || row['Doctor'] || '';

        if (!name || !phone) {
          skipped++;
          errorsList.push(`Row ${i + 2}: Missing name or phone number.`);
          setProgress(prev => ({ ...prev, current: i + 1 }));
          continue;
        }

        try {
          const clientsRef = collection(db, 'clients');
          const q = query(clientsRef, where('ownerId', '==', userId), where('phone', '==', phone));
          const existing = await getDocs(q);

          let clientId = '';

          if (!existing.empty) {
            clientId = existing.docs[0].id;
          } else {
            const clientData: Omit<Client, 'id'> = {
              name: String(name),
              phone: phone,
              address: String(address),
              source: String(source),
              concern: String(concern),
              searchName: String(name).toLowerCase(),
              ownerId: userId,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            };

            const newDoc = await addDoc(collection(db, 'clients'), clientData);
            clientId = newDoc.id;
          }

          // Process Treatment if provided
          if (tName) {
            let treatmentDateObj = new Date();
            if (tDateRaw) {
              try {
                // Handle common Excel date formats if possible, or expect yyyy-mm-dd
                treatmentDateObj = typeof tDateRaw === 'number' 
                  ? new Date(Math.round((tDateRaw - 25569) * 86400 * 1000))
                  : new Date(tDateRaw);
              } catch (e) {
                console.error("Invalid treatment date format for row", i+2);
              }
            }

            const followUpDate = addDays(treatmentDateObj, tFollowUpDays);

            const treatmentData = {
              treatmentName: String(tName),
              productUsage: String(tIntensity),
              date: treatmentDateObj,
              followUpDays: tFollowUpDays.toString(),
              followUpDate: followUpDate,
              doctorName: tDoctor,
              addedByRole: 'staff',
              ownerId: userId,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              // Add as a service as well for full compatibility with newer UI features
              services: [{
                name: String(tName),
                mrp: 0,
                discount: 0,
                discountType: 'percentage' as const,
                productUsage: String(tIntensity)
              }]
            };

            await addDoc(collection(db, `clients/${clientId}/treatments`), treatmentData);
          }

          success++;
        } catch (err: any) {
          skipped++;
          errorsList.push(`Row ${i + 2}: ${err.message}`);
        }

        setProgress(prev => ({ ...prev, current: i + 1 }));
      }

      setResults({ success, skipped, errors: errorsList });
    } catch (err: any) {
      setError(err.message || 'Failed to process file');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      processFile(file);
    } else {
      setError('Please upload a valid Excel file (.xlsx or .xls)');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-white rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-brand-border/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-brand-secondary uppercase tracking-tight">Bulk Import Patients</h2>
              <p className="text-[10px] font-bold text-brand-muted uppercase tracking-widest mt-0.5">Upload Excel Sheet Record</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-brand-muted">
            <X size={20} />
          </button>
        </div>

        <div className="p-8">
          {!loading && !results ? (
            <div className="space-y-6">
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-3xl p-12 transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-4 ${
                  isDragging ? 'border-brand-primary bg-blue-50/50' : 'border-brand-border hover:border-brand-primary/50 bg-slate-50/50'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xlsx, .xls"
                  className="hidden"
                />
                
                <div className={`p-4 rounded-full transition-all ${isDragging ? 'bg-brand-primary text-white scale-110' : 'bg-white text-brand-muted shadow-sm'}`}>
                  <Upload size={32} />
                </div>
                
                <div>
                  <p className="text-sm font-bold text-brand-secondary">Click or drag Excel file to upload</p>
                  <p className="text-xs text-brand-muted mt-1 uppercase font-black tracking-widest">Supports .xlsx, .xls</p>
                </div>

                {error && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-xs font-bold">
                    <AlertCircle size={14} />
                    {error}
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-brand-secondary/5 rounded-2xl border border-brand-secondary/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm text-brand-secondary">
                    <Download size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-brand-secondary">Need a template?</h4>
                    <p className="text-[10px] text-brand-muted mt-0.5">Download our pre-formatted Excel guide</p>
                  </div>
                </div>
                <button
                  onClick={downloadTemplate}
                  className="w-full sm:w-auto px-4 py-2 bg-white border border-brand-border rounded-xl text-xs font-bold text-brand-secondary hover:border-brand-primary hover:text-brand-primary transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  Download Guide
                </button>
              </div>
            </div>
          ) : loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-center gap-6">
              <div className="relative">
                <Loader2 size={64} className="text-brand-primary animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-brand-secondary">
                  {Math.round((progress.current / progress.total) * 100)}%
                </div>
              </div>
              <div>
                <h3 className="text-lg font-black text-brand-secondary uppercase tracking-tighter">Processing Patients...</h3>
                <p className="text-sm text-brand-muted mt-1">Importing record {progress.current} of {progress.total}</p>
              </div>
              <div className="w-full max-w-xs bg-slate-100 h-2 rounded-full overflow-hidden">
                <motion.div
                  className="bg-brand-primary h-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          ) : results ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl text-center">
                  <div className="text-2xl font-black text-emerald-600 leading-none">{results.success}</div>
                  <div className="text-[9px] font-black text-emerald-600/60 uppercase tracking-widest mt-2 flex items-center justify-center gap-1">
                    <CheckCircle2 size={10} />
                    Imported Successfully
                  </div>
                </div>
                <div className="bg-slate-50 border border-brand-border p-4 rounded-2xl text-center">
                  <div className="text-2xl font-black text-brand-muted leading-none">{results.skipped}</div>
                  <div className="text-[9px] font-black text-brand-muted/60 uppercase tracking-widest mt-2 flex items-center justify-center gap-1">
                    <AlertCircle size={10} />
                    Rows Skipped/Errors
                  </div>
                </div>
              </div>

              {results.errors.length > 0 && (
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-brand-muted uppercase tracking-widest ml-1">Error Details</label>
                  <div className="bg-slate-50 rounded-2xl p-4 border border-brand-border max-h-40 overflow-y-auto space-y-1">
                    {results.errors.map((err, i) => (
                      <p key={i} className="text-[10px] text-brand-muted font-medium flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                        {err}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={onComplete}
                className="w-full py-4 bg-brand-secondary text-white rounded-2xl font-black uppercase tracking-widest hover:bg-brand-secondary/90 transition-all shadow-xl shadow-brand-secondary/20"
              >
                Close & Refresh Registry
              </button>
            </div>
          ) : null}
        </div>
      </motion.div>
    </motion.div>
  );
}
