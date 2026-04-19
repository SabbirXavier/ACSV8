import React, { useState, useEffect } from 'react';
import { FlaskConical, Atom, Dna, Calculator, Download, FolderOpen } from 'lucide-react';
import { firestoreService } from '../services/firestoreService';
import MarkdownRenderer from './MarkdownRenderer';

const iconMap: Record<string, any> = {
  FlaskConical,
  Atom,
  Dna,
  Calculator,
  Download,
  FolderOpen
};

export default function TabDownloads() {
  const [downloads, setDownloads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return firestoreService.listenToCollection('downloads', (data) => {
      setDownloads(data);
      setLoading(false);
    });
  }, []);

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, url: string, label: string) => {
    if (url.startsWith('data:')) {
      e.preventDefault();
      const a = document.createElement('a');
      a.href = url;
      // Extract extension if possible, otherwise default to .pdf
      let ext = '.pdf';
      if (url.includes('image/png')) ext = '.png';
      else if (url.includes('image/jpeg')) ext = '.jpg';
      else if (url.includes('application/msword')) ext = '.doc';
      else if (url.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document')) ext = '.docx';
      
      a.download = label.includes('.') ? label : `${label}${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  if (loading) return <div className="text-center p-10 opacity-50 font-bold">Loading...</div>;

  return (
    <div className="space-y-5">
      <div className="mb-5">
        <h2 className="text-2xl font-bold">Study Materials</h2>
        <p className="text-sm opacity-70 mt-1">Class XII - Chapterwise & PYQs</p>
      </div>

      <div className="flex flex-col gap-4">
        {downloads.map(dl => {
          const MainIcon = iconMap[dl.icon] || Download;
          return (
            <div key={dl.id} className="glass-card !p-4">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-md" style={{ backgroundColor: dl.color }}>
                  <MainIcon size={20} />
                </div>
                <b className="tracking-wide" style={{ color: dl.color }}>
                  <MarkdownRenderer content={dl.subject} inline />
                </b>
              </div>
              <div className="flex flex-col gap-2">
                {dl.links.map((link: any, i: number) => {
                  const LinkIcon = iconMap[link.icon] || Download;
                  return (
                    <a key={i} href={link.url} onClick={(e) => handleLinkClick(e, link.url, link.label)} target="_blank" rel="noreferrer" className="flex justify-between items-center bg-white/10 dark:bg-black/10 text-[var(--text-color)] p-3 rounded-xl border border-[var(--border-color)] font-semibold transition-all hover:bg-[var(--primary)] hover:text-white hover:border-[var(--primary)] hover:-translate-y-0.5 hover:shadow-md">
                      <span><MarkdownRenderer content={link.label} inline /></span><LinkIcon size={18} />
                    </a>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
