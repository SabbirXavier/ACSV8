import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  FileText, 
  Video, 
  Image as ImageIcon, 
  Lock, 
  ChevronRight, 
  Search, 
  Clock, 
  Folder,
  ArrowLeft,
  Shield,
  ExternalLink,
  AlertCircle,
  Plus,
  Edit2,
  Trash2,
  Upload,
  X
} from 'lucide-react';
import { db } from '../firebase';
import { collection, onSnapshot, query, where, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';

interface TabMyBatchProps {
  userEnrollment: any;
  user: any;
  facultyBatches: any[];
}

const TabMyBatch: React.FC<TabMyBatchProps> = ({ userEnrollment, user, facultyBatches }) => {
  const isAdmin = (email: string) => {
    const adminEmail = (import.meta.env.VITE_ADMIN_EMAIL || 'xavierscot3454@gmail.com').toLowerCase();
    const adminEmail1 = (import.meta.env.VITE_ADMIN_EMAIL_1 || 'xavierscot3454@gmail.com').toLowerCase();
    const adminEmail2 = (import.meta.env.VITE_ADMIN_EMAIL_2 || 'helixsmith.xavy@gmail.com').toLowerCase();
    const adminEmail3 = 'dcpromoidse@gmail.com';
    const e = email?.toLowerCase();
    return e === adminEmail || e === adminEmail1 || e === adminEmail2 || e === adminEmail3;
  };

  const isUserAdmin = user?.email && isAdmin(user.email);
  const isUserFaculty = isUserAdmin || (facultyBatches && facultyBatches.length > 0);
  
  // Faculty mapping: find which grades/subjects this user can manage
  const managedAccess = facultyBatches.map(fb => {
    // We need to look up the batch to find its grade? 
    // Wait, batchFaculty stores batchId. Let's assume it has batchName which usually contains Class info.
    // Or we could have stored it during assignment.
    return { batchId: fb.batchId, batchName: fb.batchName };
  });

  const [subjects, setSubjects] = useState<string[]>([]);
  const [activeSubject, setActiveSubject] = useState<string>('');
  const [activeGrade, setActiveGrade] = useState<string>(userEnrollment?.grade || 'XII');
  const [folders, setFolders] = useState<any[]>([]);
  const [activeFolder, setActiveFolder] = useState<any | null>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingMaterial, setViewingMaterial] = useState<any | null>(null);
  
  // Faculty Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'folder' | 'material'>('material');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canManageCurrentBatch = isUserAdmin || facultyBatches.some(fb => fb.batchName?.includes(`Class ${activeGrade}`));
  // Note: This logic assumes batch names include "Class XII", etc.

  useEffect(() => {
    if (isUserAdmin) {
      setSubjects(['PHYSICS', 'CHEMISTRY', 'MATHEMATICS', 'BIOLOGY']);
      setActiveSubject('PHYSICS');
    } else if (userEnrollment?.subjects) {
      setSubjects(userEnrollment.subjects);
      setActiveSubject(userEnrollment.subjects[0] || '');
      setActiveGrade(userEnrollment.grade || 'XII');
    }
  }, [userEnrollment, isUserAdmin]);

  useEffect(() => {
    if (!activeSubject) return;

    const qFolders = isUserAdmin 
      ? query(collection(db, 'course_folders'), where('subject', '==', activeSubject), where('grade', '==', activeGrade))
      : query(
        collection(db, 'course_folders'),
        where('subject', '==', activeSubject),
        where('grade', '==', activeGrade)
      );

    const unsubFolders = onSnapshot(qFolders, (snap) => {
      setFolders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qMaterials = isUserAdmin
      ? query(collection(db, 'exclusive_content'), where('subject', '==', activeSubject), where('grade', '==', activeGrade))
      : query(
        collection(db, 'exclusive_content'),
        where('subject', '==', activeSubject),
        where('grade', '==', activeGrade)
      );

    const unsubMaterials = onSnapshot(qMaterials, (snap) => {
      setMaterials(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubFolders();
      unsubMaterials();
    };
  }, [activeSubject, userEnrollment]);

  const filteredFolders = folders.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentFolderMaterials = materials.filter(m => m.folderId === activeFolder?.id);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, callback: (url: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const toastId = toast.loading('Uploading file...');
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        callback(base64);
        toast.success('File uploaded successfully', { id: toastId });
      };
      reader.readAsDataURL(file);
    } catch (err) {
      toast.error('Upload failed', { id: toastId });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const toastId = toast.loading('Saving...');
    
    try {
      const collectionName = modalType === 'folder' ? 'course_folders' : 'exclusive_content';
      const data = {
        ...formData,
        subject: activeSubject,
        grade: activeGrade,
        updatedAt: serverTimestamp(),
      };
      
      if (!editingId) {
        data.createdAt = serverTimestamp();
        await addDoc(collection(db, collectionName), data);
      } else {
        await updateDoc(doc(db, collectionName, editingId), data);
      }
      
      toast.success('Successfully saved!', { id: toastId });
      setIsModalOpen(false);
    } catch (err: any) {
      toast.error('Error: ' + err.message, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (type: 'folder' | 'material', id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) return;
    const toastId = toast.loading('Deleting...');
    try {
      const collectionName = type === 'folder' ? 'course_folders' : 'exclusive_content';
      await deleteDoc(doc(db, collectionName, id));
      toast.success('Deleted', { id: toastId });
      if (activeFolder?.id === id) setActiveFolder(null);
    } catch (err: any) {
      toast.error('Delete failed: ' + err.message, { id: toastId });
    }
  };

  // Anti-download measures
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      if (viewingMaterial) e.preventDefault();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (viewingMaterial && (e.ctrlKey && (e.key === 'p' || e.key === 's' || e.key === 'u'))) {
        e.preventDefault();
      }
    };

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [viewingMaterial]);

  const MaterialViewer = ({ material, onClose }: { material: any, onClose: () => void }) => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col"
    >
      <div className="flex items-center justify-between p-4 bg-white/5 backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <ArrowLeft size={24} className="text-white" />
          </button>
          <div>
            <h3 className="text-white font-bold">{material.title}</h3>
            <p className="text-[10px] text-white/50 font-black uppercase tracking-widest">{material.type} • Protected</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 text-amber-500 rounded-lg text-[10px] font-black uppercase">
          <Shield size={14} /> Screen Safe
        </div>
      </div>
      
      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        {material.type === 'pdf' ? (
          <iframe 
            src={`${material.url}#toolbar=0&navpanes=0&scrollbar=0`}
            className="w-full h-full border-none select-none"
            title={material.title}
          />
        ) : material.type === 'video' ? (
          <div className="w-full h-full max-w-5xl aspect-video relative group">
             {/* YouTube/Video embed logic here */}
             <iframe 
               src={material.url.includes('youtube.com') ? material.url.replace('watch?v=', 'embed/') : material.url}
               className="w-full h-full border-none rounded-2xl shadow-2xl"
               allow="autoplay; encrypted-media"
               allowFullScreen
             />
          </div>
        ) : (
          <div className="text-center p-8 glass-card">
            <AlertCircle size={48} className="mx-auto text-amber-500 mb-4" />
            <h4 className="text-xl font-bold mb-2">Notice</h4>
            <p className="text-sm opacity-60 mb-6">This content is protected and cannot be previewed here.</p>
            <a href={material.url} target="_blank" rel="noreferrer" className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold">Open Secure Link</a>
          </div>
        )}

        {/* Anti-print Overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] select-none flex flex-wrap gap-20 items-center justify-center overflow-hidden">
           {Array.from({length: 20}).map((_, i) => (
             <span key={i} className="text-white font-black text-4xl rotate-45 select-none">{userEnrollment?.email}</span>
           ))}
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 min-h-screen">
      <AnimatePresence>
        {viewingMaterial && <MaterialViewer material={viewingMaterial} onClose={() => setViewingMaterial(null)} />}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 bg-indigo-500 text-white rounded text-[10px] font-black uppercase">Enrolled</span>
            <span className="text-[10px] font-bold opacity-40 uppercase tracking-widest">LMS Mission Control</span>
          </div>
          <h1 className="text-4xl font-black mb-1">My Batch</h1>
          <p className="text-sm opacity-50 font-medium italic">
            {isUserAdmin ? `Administrative Access: Viewing all course materials for Class ${activeGrade}.` : isUserFaculty ? `Faculty Access: Managing materials for assigned batches.` : `Welcome back, ${userEnrollment?.name}. Class ${activeGrade} Materials are ready.`}
          </p>
          {(isUserAdmin || isUserFaculty) && (
            <div className="flex gap-2 mt-4 p-1 bg-white/5 border border-white/5 rounded-xl w-fit">
              {['XII', 'XI', 'X'].map(grade => (
                <button
                  key={grade}
                  onClick={() => { setActiveGrade(grade); setActiveFolder(null); }}
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${
                    activeGrade === grade 
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                      : 'hover:bg-white/5 opacity-50'
                  }`}
                >
                  CLASS {grade}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 p-1 bg-white/5 border border-white/5 rounded-2xl overflow-x-auto no-scrollbar">
          {subjects.map(sub => (
            <button
              key={sub}
              onClick={() => { setActiveSubject(sub); setActiveFolder(null); }}
              className={`px-6 py-3 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
                activeSubject === sub 
                  ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/20' 
                  : 'hover:bg-white/5 opacity-50'
              }`}
            >
              {sub}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Navigation Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
            <input 
              type="text"
              placeholder="Search chapters..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold focus:border-indigo-500 outline-none transition-all"
            />
          </div>

          <div className="glass-card p-6 border border-white/5 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] font-black tracking-widest uppercase opacity-40">Chapter Folders</h3>
              {canManageCurrentBatch && (
                <button 
                  onClick={() => {
                    setModalType('folder');
                    setEditingId(null);
                    setFormData({ name: '' });
                    setIsModalOpen(true);
                  }}
                  className="p-1 px-2 bg-indigo-600/20 text-indigo-500 rounded-lg text-[9px] font-black hover:bg-indigo-600/30 transition-all flex items-center gap-1"
                >
                  <Plus size={12} /> New
                </button>
              )}
              {!canManageCurrentBatch && <Folder size={14} className="opacity-20" />}
            </div>
            
            <div className="space-y-2">
              {filteredFolders.map(folder => (
                <div key={folder.id} className="group relative">
                  <button
                    onClick={() => setActiveFolder(folder)}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all border ${
                      activeFolder?.id === folder.id
                        ? 'bg-indigo-600/10 border-indigo-600 text-indigo-500'
                        : 'bg-white/5 border-transparent hover:border-white/10 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-xl ${activeFolder?.id === folder.id ? 'bg-indigo-600 text-white' : 'bg-white/10'}`}>
                        <BookOpen size={18} />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-black leading-none mb-1">{folder.name}</p>
                        <p className="text-[9px] font-bold opacity-50 uppercase">{activeSubject} Units</p>
                      </div>
                    </div>
                    <ChevronRight size={18} className={activeFolder?.id === folder.id ? 'opacity-100' : 'opacity-20'} />
                  </button>
                  {canManageCurrentBatch && (
                    <div className="absolute right-10 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                       <button 
                         onClick={(e) => {
                           e.stopPropagation();
                           setModalType('folder');
                           setEditingId(folder.id);
                           setFormData({ name: folder.name });
                           setIsModalOpen(true);
                         }}
                         className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white"
                       >
                         <Edit2 size={12} />
                       </button>
                       <button 
                         onClick={(e) => {
                           e.stopPropagation();
                           handleDelete('folder', folder.id, folder.name);
                         }}
                         className="p-1.5 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-red-500"
                       >
                         <Trash2 size={12} />
                       </button>
                    </div>
                  )}
                </div>
              ))}
              {filteredFolders.length === 0 && (
                <div className="py-8 text-center bg-white/[0.02] rounded-2xl border border-dashed border-white/10">
                  <p className="text-xs font-bold opacity-30 italic">No chapters found</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-8">
          <AnimatePresence mode="wait">
            {!activeFolder ? (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col items-center justify-center p-20 glass-card border border-dashed border-white/10 bg-white/[0.01]"
              >
                <div className="w-24 h-24 bg-indigo-500/10 rounded-full flex items-center justify-center mb-6">
                  <BookOpen size={48} className="text-indigo-500 animate-pulse" />
                </div>
                <h3 className="text-2xl font-black mb-2 opacity-80 text-center">Select a Subject Chapter</h3>
                <p className="text-sm opacity-40 text-center max-w-xs font-medium">Choose a folder from the left to access protected notes, PDFs, and presentations.</p>
              </motion.div>
            ) : (
              <motion.div 
                key={activeFolder.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between mb-8">
                   <div className="flex items-center gap-4">
                      <button onClick={() => setActiveFolder(null)} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-colors">
                        <ArrowLeft size={20} />
                      </button>
                      <div>
                        <h2 className="text-3xl font-black leading-none mb-1">{activeFolder.name}</h2>
                        <div className="flex items-center gap-2">
                           <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">{activeSubject}</span>
                           <span className="text-[10px] font-bold opacity-30">•</span>
                           <span className="text-[10px] font-bold opacity-30">{currentFolderMaterials.length} Study Assets</span>
                        </div>
                      </div>
                 </div>
                 <div className="flex items-center gap-3">
                    {canManageCurrentBatch && (
                      <button 
                        onClick={() => {
                          setModalType('material');
                          setEditingId(null);
                          setFormData({ title: '', description: '', type: 'pdf', url: '', folderId: activeFolder.id });
                          setIsModalOpen(true);
                        }}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-500/20 flex items-center gap-2"
                      >
                        <Plus size={16} /> Add Asset
                      </button>
                    )}
                    <div className="hidden md:flex flex-col items-end">
                       <span className="text-[10px] font-black text-emerald-500 uppercase flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                         <Lock size={12} /> Encrypted Content
                       </span>
                    </div>
                 </div>
              </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {currentFolderMaterials.map((material) => (
                    <div 
                      key={material.id} 
                      className="group p-5 rounded-3xl bg-white/5 border border-white/5 hover:border-indigo-500/30 hover:bg-indigo-500/[0.03] transition-all cursor-default relative overflow-hidden flex flex-col gap-4"
                    >
                      <div className="absolute top-0 right-0 p-4 flex gap-2">
                         {canManageCurrentBatch && (
                           <>
                             <button 
                               onClick={() => {
                                 setModalType('material');
                                 setEditingId(material.id);
                                 setFormData({ ...material });
                                 setIsModalOpen(true);
                               }}
                               className="p-2 bg-white/10 hover:bg-white/20 rounded-xl shadow-lg backdrop-blur-md transition-all text-white"
                             >
                                <Edit2 size={14} />
                             </button>
                             <button 
                               onClick={() => handleDelete('material', material.id, material.title)}
                               className="p-2 bg-red-500/10 hover:bg-red-500/20 rounded-xl shadow-lg backdrop-blur-md transition-all text-red-500"
                             >
                                <Trash2 size={14} />
                             </button>
                           </>
                         )}
                         <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/40 opacity-0 group-hover:opacity-100 transition-opacity">
                            <ChevronRight size={16} />
                         </div>
                      </div>

                      <div className="flex items-start gap-4">
                        <div className={`p-4 rounded-2xl ${
                          material.type === 'pdf' ? 'bg-rose-500/10 text-rose-500' :
                          material.type === 'video' ? 'bg-sky-500/10 text-sky-500' :
                          'bg-indigo-500/10 text-indigo-500'
                        }`}>
                          {material.type === 'pdf' ? <FileText size={28} /> : material.type === 'video' ? <Video size={28} /> : <ImageIcon size={28} />}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-lg leading-tight mb-1 group-hover:text-indigo-400 transition-colors">{material.title}</h4>
                          <p className="text-xs opacity-50 font-medium line-clamp-1">{material.description || 'No description available.'}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-white/5">
                        <div className="flex items-center gap-4">
                           <div className="flex items-center gap-1.5">
                              <Clock size={12} className="opacity-30" />
                              <span className="text-[10px] font-bold opacity-40 italic">Added {material.createdAt?.toDate ? material.createdAt.toDate().toLocaleDateString() : 'Now'}</span>
                           </div>
                        </div>
                        <button 
                          onClick={() => setViewingMaterial(material)}
                          className="px-5 py-2 bg-white/5 hover:bg-indigo-600 hover:text-white rounded-xl text-xs font-black transition-all border border-white/5 hover:border-indigo-600"
                        >
                          Access Asset
                        </button>
                      </div>
                    </div>
                  ))}

                  {currentFolderMaterials.length === 0 && (
                    <div className="col-span-full py-16 text-center bg-white/[0.02] rounded-3xl border border-dashed border-white/10">
                      <AlertCircle size={32} className="mx-auto text-white/20 mb-4" />
                      <p className="text-sm font-bold opacity-30 italic">Material coming soon for this chapter</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Modal for Faculty Content Management */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-[#1a1a1a] w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-white/10"
          >
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-indigo-600 text-white">
              <h3 className="text-xl font-black capitalize">{editingId ? 'Edit' : 'Add New'} {modalType}</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
               {modalType === 'folder' ? (
                 <>
                   <div className="space-y-1">
                     <label className="text-[10px] font-black uppercase opacity-30 ml-1">Folder Name</label>
                     <input 
                       className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold focus:border-indigo-500 outline-none"
                       value={formData.name || ''}
                       onChange={e => setFormData({...formData, name: e.target.value})}
                       placeholder="e.g. Mechanical Properties"
                       required
                     />
                   </div>
                 </>
               ) : (
                 <>
                   <div className="space-y-1">
                     <label className="text-[10px] font-black uppercase opacity-30 ml-1">Asset Title</label>
                     <input 
                       className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold focus:border-indigo-500 outline-none"
                       value={formData.title || ''}
                       onChange={e => setFormData({...formData, title: e.target.value})}
                       placeholder="e.g. Chapter 1 Notes.pdf"
                       required
                     />
                   </div>
                   <div className="space-y-1">
                     <label className="text-[10px] font-black uppercase opacity-30 ml-1">Summary</label>
                     <textarea 
                       className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold focus:border-indigo-500 outline-none min-h-[80px]"
                       value={formData.description || ''}
                       onChange={e => setFormData({...formData, description: e.target.value})}
                       placeholder="Quick description of the content..."
                     />
                   </div>
                   <div className="grid grid-cols-2 gap-3">
                     <div className="space-y-1">
                       <label className="text-[10px] font-black uppercase opacity-30 ml-1">Type</label>
                       <select 
                         className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold focus:border-indigo-500 outline-none [&>option]:bg-gray-900"
                         value={formData.type || 'pdf'}
                         onChange={e => setFormData({...formData, type: e.target.value})}
                         required
                       >
                         <option value="pdf">Secured PDF</option>
                         <option value="video">Protected Video</option>
                         <option value="image">Encrypted Image</option>
                       </select>
                     </div>
                     <div className="space-y-1">
                       <label className="text-[10px] font-black uppercase opacity-30 ml-1">Course Folder</label>
                       <select 
                         className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold focus:border-indigo-500 outline-none [&>option]:bg-gray-900"
                         value={formData.folderId || ''}
                         onChange={e => setFormData({...formData, folderId: e.target.value})}
                         required
                       >
                         <option value="">Select Folder</option>
                         {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                       </select>
                     </div>
                   </div>
                   <div className="space-y-1">
                     <label className="text-[10px] font-black uppercase opacity-30 ml-1">Content Source</label>
                     <div className="flex gap-2">
                       <input 
                         className="flex-1 p-4 bg-white/5 border border-white/10 rounded-2xl text-xs font-bold focus:border-indigo-500 outline-none"
                         value={formData.url?.startsWith('data:') ? 'Local File Selected' : (formData.url || '')}
                         onChange={e => setFormData({...formData, url: e.target.value})}
                         placeholder={formData.type === 'video' ? "YouTube Link" : "URL or Upload"}
                         disabled={formData.url?.startsWith('data:')}
                         required
                       />
                       {formData.url?.startsWith('data:') ? (
                         <button type="button" onClick={() => setFormData({...formData, url: ''})} className="px-3 bg-red-500/10 text-red-500 rounded-2xl font-bold">X</button>
                       ) : (
                         <label className="p-4 bg-indigo-600/10 hover:bg-indigo-600/20 rounded-2xl cursor-pointer transition-colors flex items-center justify-center text-indigo-500">
                           <Upload size={20} />
                           <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, (url) => setFormData({...formData, url: url}))} accept={formData.type === 'image' ? 'image/*' : formData.type === 'pdf' ? '.pdf' : '*/*'} />
                         </label>
                       )}
                     </div>
                   </div>
                 </>
               )}

               <div className="pt-4 flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 p-4 rounded-2xl bg-white/5 text-sm font-bold hover:bg-white/10 transition-all font-black uppercase tracking-widest"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="flex-1 p-4 rounded-2xl bg-indigo-600 text-white text-sm font-black uppercase tracking-widest shadow-xl shadow-indigo-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? 'Syncing...' : (editingId ? 'Update' : 'Publish')}
                  </button>
               </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default TabMyBatch;
