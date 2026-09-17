
import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  User, UserRole, Solicitacao, RequestStatus, RequestLevel, LogEvento, 
  Orcamento, PurchaseCategory, Supplier, InventoryItem, 
  InventoryMovement, PurchaseRecord, CondoContact,
  RequestType, BudgetAttachment
} from '../types';
import { supabase } from '../lib/supabaseClient';
import { sendManualNotification } from '../services/notificationService';
import { LOGO_URL } from '../constants';

interface AppContextType {
  currentUser: User | null;
  users: User[];
  requests: Solicitacao[];
  suppliers: Supplier[];
  inventoryItems: InventoryItem[];
  inventoryMovements: InventoryMovement[];
  purchaseHistory: PurchaseRecord[];
  categories: PurchaseCategory[];
  condoContacts: CondoContact[];
  loading: boolean;
  isOnline: boolean;
  logoUrl: string;
  selectedCondoId: string;
  
  setSelectedCondoId: (id: string) => void;
  login: (u: string, p: string) => Promise<void>;
  logout: () => void;
  refreshData: () => Promise<void>;
  
  // Requests
  addRequest: (req: Partial<Solicitacao>, files: File[]) => Promise<void>;
  createStockReplenishmentRequest: (condoId: string, items: any[]) => Promise<string | null>;
  updateRequest: (id: string, data: Partial<Solicitacao>) => Promise<void>;
  updateRequestStatus: (id: string, status: RequestStatus, note: string, extra?: any) => Promise<boolean>;
  deleteRequest: (id: string) => Promise<void>;
  getRequestsAll: () => Solicitacao[];
  getRequestsByCondo: (condoId: string) => Solicitacao[];
  markMessagesAsRead: (reqId: string) => Promise<void>; // NEW
  
  // Users
  addUser: (u: User) => Promise<boolean>;
  updateUser: (id: string, data: Partial<User>) => Promise<boolean>;
  removeUser: (id: string) => Promise<void>;
  migrateUser: (oldId: string, newId: string, data: any) => Promise<boolean>;
  
  // Suppliers
  addSupplier: (s: Partial<Supplier>) => Promise<string>;
  updateSupplier: (id: string, data: Partial<Supplier>) => Promise<void>;
  toggleSupplierStatus: (id: string) => Promise<void>;
  
  // Inventory
  registerConsumption: (itemId: string, qty: number, reason: string) => Promise<boolean>;
  adjustStockQuantity: (itemId: string, newQty: number, reason: string) => Promise<boolean>;
  updateInventoryItem: (id: string, data: Partial<InventoryItem>) => Promise<boolean>; 
  deleteInventoryItem: (id: string) => Promise<void>; 
  
  // Categories
  addCategory: (c: PurchaseCategory) => Promise<void>;
  updateCategory: (id: string, c: Partial<PurchaseCategory>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  
  // Contacts
  addContact: (c: Partial<CondoContact>) => Promise<void>;
  updateContact: (id: string, c: Partial<CondoContact>) => Promise<void>;
  deleteContact: (id: string) => Promise<void>;
  
  // Budgets
  saveBudget: (reqId: string, budget: Orcamento) => Promise<void>;
  deleteBudget: (reqId: string, budgetId: string, reason: string) => Promise<void>;
  
  // Misc
  updateLogo: (file: File) => Promise<void>;
  fetchLastPurchase: (supplierId: string, condoId: string) => Promise<any>;
  recordPurchaseMemory: (req: Solicitacao, budget: Orcamento) => Promise<void>;
  triggerManualNotification: (reqId: string) => Promise<void>;
  sendMessage: (reqId: string, text: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// MASTER USER DEFINITION
const MASTER_USER: User = { 
    id: 'brasileiroadm', 
    nome: 'Brasileiro Adm (Master)', 
    role: UserRole.ADMIN, 
    password: 'br@sileiro010203' 
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // Initialize users from localStorage if available (Fail-safe for API issues)
  const [users, setUsers] = useState<User[]>(() => {
      const cached = localStorage.getItem('app_users_cache');
      const base = [MASTER_USER];
      if (cached) {
          try {
              const parsed = JSON.parse(cached);
              // Ensure master is always present even in cache
              if (!parsed.some((u: User) => u.id === MASTER_USER.id)) {
                  return [...parsed, MASTER_USER];
              }
              return parsed;
          } catch (e) { return base; }
      }
      return base;
  });

  const [requests, setRequests] = useState<Solicitacao[]>(() => {
      try {
          const cached = localStorage.getItem('app_requests_cache');
          return cached ? JSON.parse(cached) : [];
      } catch { return []; }
  });
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
      try {
          const cached = localStorage.getItem('app_suppliers_cache');
          return cached ? JSON.parse(cached) : [];
      } catch { return []; }
  });
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>(() => {
      try {
          const cached = localStorage.getItem('app_inventory_cache');
          return cached ? JSON.parse(cached) : [];
      } catch { return []; }
  });
  const [inventoryMovements, setInventoryMovements] = useState<InventoryMovement[]>([]);
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseRecord[]>([]);
  const [categories, setCategories] = useState<PurchaseCategory[]>(() => {
      try {
          const cached = localStorage.getItem('app_categories_cache');
          return cached ? JSON.parse(cached) : [];
      } catch { return []; }
  });
  const [condoContacts, setCondoContacts] = useState<CondoContact[]>(() => {
      try {
          const cached = localStorage.getItem('app_contacts_cache');
          return cached ? JSON.parse(cached) : [];
      } catch { return []; }
  });
  
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [logoUrl, setLogoUrl] = useState(LOGO_URL);
  const [selectedCondoId, setSelectedCondoId] = useState('all');

  // Initial Load
  useEffect(() => {
    const init = async () => {
      await refreshData();
      
      // Load user from local storage if exists
      const savedUser = localStorage.getItem('currentUser');
      if (savedUser) {
        try {
            const parsed = JSON.parse(savedUser);
            setCurrentUser(parsed);
        } catch (e) { console.error("Session parse error"); }
      }
    };
    init();

    window.addEventListener('online', () => setIsOnline(true));
    window.addEventListener('offline', () => setIsOnline(false));
    return () => {
        window.removeEventListener('online', () => setIsOnline(true));
        window.removeEventListener('offline', () => setIsOnline(false));
    };
  }, []);

  // Sync users to local storage whenever they change
  useEffect(() => {
      if (users.length > 0) {
          localStorage.setItem('app_users_cache', JSON.stringify(users));
      }
  }, [users]);

  // Force refresh when user changes (to get their specific data permissions)
  useEffect(() => {
      if (currentUser) {
          refreshData();
      }
  }, [currentUser?.id]);

  const refreshData = async () => {
      setLoading(true);
      try {
          // Fetch from Supabase - using Promise.all for parallelism
          const [
              { data: usersData, error: usersError }, 
              { data: reqsData, error: reqsError },
              { data: supData },
              { data: invData },
              { data: invMovData },
              { data: catsData },
              { data: contactsData },
              { data: settingsData },
              { data: messagesData, error: messagesError }
          ] = await Promise.all([
              supabase.from('usuarios').select('*'),
              supabase.from('solicitacoes').select('*').order('data_solicitacao', { ascending: false }),
              supabase.from('suppliers').select('*'),
              supabase.from('inventory_items').select('*'),
              supabase.from('inventory_movements').select('*'),
              supabase.from('categories').select('*'),
              supabase.from('contacts').select('*'),
              supabase.from('app_settings').select('logo_url').single(),
              // Try to fetch messages table separately. If it fails (table missing), we handle it.
              supabase.from('messages').select('*')
          ]);

          // DETECT MISSING TABLES ERROR (42P01)
          if (usersError?.code === '42P01' || reqsError?.code === '42P01') {
              console.warn("DB WARNING: TABLES MISSING (42P01)");
              if (!localStorage.getItem('db_alert_shown')) {
                  console.warn("⚠️ ATENÇÃO: As tabelas do banco de dados não foram encontradas. \n\nPor favor, copie o arquivo 'database_setup.sql' e rode no SQL Editor do Supabase para corrigir.");
                  localStorage.setItem('db_alert_shown', 'true');
              }
          }

          if (messagesError) {
              console.warn("Could not fetch messages table, falling back to JSONB:", messagesError);
          }

          // Handle Users Logic with Safety
          if (usersError) {
              console.warn("Could not fetch usuarios from DB, using cache:", usersError.message || usersError);
          } else if (usersData) {
              const dbUsers = usersData.map((u: any) => ({
                  ...u,
                  role: (u.role && u.role.toString().toUpperCase() === 'ADMIN') ? UserRole.ADMIN : UserRole.CONDOMINIO
              })) as User[];
              const masterIdLower = MASTER_USER.id.toLowerCase();
              const filteredDbUsers = dbUsers.filter(u => u.id.toLowerCase() !== masterIdLower);
              const combinedUsers = [...filteredDbUsers, MASTER_USER];
              setUsers(combinedUsers);
              try {
                  localStorage.setItem('app_users_cache', JSON.stringify(combinedUsers));
              } catch { /* ignore quota */ }
          }

          if (reqsData) {
              const mappedRequests = (reqsData as any[]).map(r => {
                  // Merge messages from separate table fetch (messagesData) and JSONB column (messages)
                  const tableMsgs = messagesData ? messagesData.filter((m: any) => m.request_id === r.id) : [];
                  const jsonbMsgs = Array.isArray(r.messages) ? r.messages : [];
                  
                  // Combine and deduplicate by ID
                  const allMsgs = [...tableMsgs, ...jsonbMsgs];
                  const uniqueMsgs = Array.from(new Map(allMsgs.map(m => [m.id, m])).values());
                  
                  // Sort by created_at
                  uniqueMsgs.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                  
                  return {
                      ...r,
                      messages: uniqueMsgs
                  };
              });
              setRequests(mappedRequests as Solicitacao[]);
              try {
                  localStorage.setItem('app_requests_cache', JSON.stringify(mappedRequests));
              } catch { /* ignore quota */ }
          }
          if (supData) {
              setSuppliers(supData as Supplier[]);
              try { localStorage.setItem('app_suppliers_cache', JSON.stringify(supData)); } catch { /* ignore quota */ }
          }
          if (invData) {
              setInventoryItems(invData as InventoryItem[]);
              try { localStorage.setItem('app_inventory_cache', JSON.stringify(invData)); } catch { /* ignore quota */ }
          }
          if (invMovData) setInventoryMovements(invMovData as InventoryMovement[]);
          if (catsData) {
              setCategories(catsData as PurchaseCategory[]);
              try { localStorage.setItem('app_categories_cache', JSON.stringify(catsData)); } catch { /* ignore quota */ }
          }
          if (contactsData) {
              setCondoContacts(contactsData as CondoContact[]);
              try { localStorage.setItem('app_contacts_cache', JSON.stringify(contactsData)); } catch { /* ignore quota */ }
          }
          if (settingsData && settingsData.logo_url) setLogoUrl(settingsData.logo_url);
          
      } catch (error) {
          console.warn("Data refresh critical failure:", error);
      } finally {
          setLoading(false);
      }
  };

  const login = async (u: string, p: string) => {
    const normalizedUser = u.trim();
    const passwordInput = p.trim();

    // 1. MASTER USER CHECK (Priority)
    if (normalizedUser === MASTER_USER.id && passwordInput === MASTER_USER.password) {
        setCurrentUser(MASTER_USER);
        localStorage.setItem('currentUser', JSON.stringify(MASTER_USER));
        setUsers(prev => {
             if (prev.some(u => u.id === MASTER_USER.id)) return prev;
             return [...prev, MASTER_USER];
        });
        setTimeout(() => refreshData(), 100);
        return;
    }

    // 2. Standard DB User Check
    let user = users.find(user => user.id.toLowerCase() === normalizedUser.toLowerCase());
    if (!user) {
        try {
            const { data } = await supabase.from('usuarios').select('*').eq('id', normalizedUser).single();
            if (data) {
                user = { ...data, role: (data.role && data.role.toString().toUpperCase() === 'ADMIN') ? UserRole.ADMIN : UserRole.CONDOMINIO } as User;
                setUsers(prev => [...prev, user!]);
            } else {
                 const { data: dataLower } = await supabase.from('usuarios').select('*').eq('id', normalizedUser.toLowerCase()).single();
                 if (dataLower) {
                     user = { ...dataLower, role: (dataLower.role && dataLower.role.toString().toUpperCase() === 'ADMIN') ? UserRole.ADMIN : UserRole.CONDOMINIO } as User;
                     setUsers(prev => [...prev, user!]);
                 }
            }
        } catch (err) { console.error("Login Error:", err); }
    }

    if (user) {
        if (user.password === passwordInput) {
            setCurrentUser(user);
            localStorage.setItem('currentUser', JSON.stringify(user));
            setTimeout(() => refreshData(), 100);
            return;
        } else {
            alert("Senha incorreta.");
            return;
        }
    }
    
    alert("Usuário não encontrado. Verifique o Login/ID.");
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
  };

  // --- Requests Logic ---

  const addRequest = async (req: Partial<Solicitacao>, files: File[]) => {
      setLoading(true);
      try {
          const newId = `REQ-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
          const uploadedAttachments: BudgetAttachment[] = [];
          if (files && files.length > 0) {
              for (const file of files) {
                  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
                  const path = `requests/${newId}/${Date.now()}_${sanitizedName}`;
                  const { error: uploadError } = await supabase.storage.from('budgets').upload(path, file);
                  if (uploadError) continue;
                  const { data: publicUrlData } = supabase.storage.from('budgets').getPublicUrl(path);
                  uploadedAttachments.push({
                      id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                      path: path,
                      publicUrl: publicUrlData.publicUrl,
                      fileName: file.name,
                      fileType: file.type,
                      fileSize: file.size,
                      uploadedAt: new Date().toISOString()
                  });
              }
          }

          const baseReq = {
              id: newId,
              ...req,
              orcamentos: [],
              attachments: uploadedAttachments,
              status: RequestStatus.NOVO,
              historico: [{ id: `h-${Date.now()}`, data: new Date().toISOString(), usuario_nome: req.responsavel_nome || 'Sistema', descricao: 'Solicitação criada.', status: RequestStatus.NOVO }],
              caveats: [],
              messages: [],
              fora_do_prazo: false,
          };
          const fullReq: Solicitacao = { ...baseReq, stock_control_enabled: false, assembly_data: req.assembly_data || { required: false, status: 'PENDENTE' } } as Solicitacao;

          let { error } = await supabase.from('solicitacoes').insert(fullReq);
          if (error && (error.message?.includes('Could not find the') || error.code === '42703')) {
              const { stock_control_enabled, assembly_data, ...legacyReq } = fullReq as any;
              const res = await supabase.from('solicitacoes').insert(legacyReq);
              error = res.error;
          }

          if (error) {
              console.error("Error creating request DB:", error);
              alert(`Erro ao salvar: ${error.message}`);
          } else {
              setRequests(prev => [fullReq, ...prev]);
              alert("Solicitação registrada com sucesso!");
          }
      } catch (e: any) {
          console.error("Exception creating request:", e);
          alert("Ocorreu um erro inesperado.");
      } finally {
          setLoading(false);
      }
  };

  const createStockReplenishmentRequest = async (condoId: string, items: any[]) => {
      setLoading(true);
      try {
          const condoUser = users.find(u => u.condominio_id === condoId);
          if (!condoUser) throw new Error("Condomínio não encontrado");

          const newId = `REQ-STOCK-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
          
          const description = "Sugestão automática de reposição baseada em itens com estoque baixo:\n\n" + 
              items.map(i => `- ${i.suggested_qty} ${i.unit} ${i.name} (Atual: ${i.current_qty})`).join('\n') +
              "\n\nEsta solicitação foi gerada pelo sistema de controle de estoque.";

          const newReq: Partial<Solicitacao> = {
              id: newId,
              condominio_id: condoId,
              condominio_nome: condoUser.nome,
              responsavel_nome: 'Gestão de Estoque (Admin)',
              data_solicitacao: new Date().toISOString(),
              titulo: 'Reposição de Estoque (Sugestão Automática)',
              descricao: description,
              tipo: RequestType.RECORRENTE,
              categoria: 'Almoxarifado',
              category_id: null,
              nivel: RequestLevel.N2,
              status: RequestStatus.AGUARDANDO_ACAO_CONDOMINIO, 
              generated_from_stock: true,
              stock_replenishment_items: items,
              stock_control_enabled: true, 
              orcamentos: [],
              attachments: [],
              historico: [{ 
                  id: `h-${Date.now()}`, 
                  data: new Date().toISOString(), 
                  usuario_nome: currentUser?.nome || 'Sistema', 
                  descricao: 'Solicitação de reposição gerada automaticamente pelo estoque.' 
              }],
              fora_do_prazo: false
          };

          const { error } = await supabase.from('solicitacoes').insert(newReq);
          
          if (error) {
              console.error("Stock Request Error:", error);
              alert("Erro ao criar solicitação: " + error.message);
              return null;
          }

          setRequests(prev => [newReq as Solicitacao, ...prev]);
          return newId;

      } catch (err) {
          console.error(err);
          alert("Erro ao gerar reposição.");
          return null;
      } finally {
          setLoading(false);
      }
  };

  const updateRequest = async (id: string, data: Partial<Solicitacao>) => {
      setRequests(prev => prev.map(r => r.id === id ? { ...r, ...data } : r));
      await supabase.from('solicitacoes').update(data).eq('id', id);
  };

  const processStockEntry = async (req: Solicitacao) => {
      if (req.stock_generated_at) return;
      if (!req.orcamento_escolhido) return;
      const budget = req.orcamentos.find(o => o.numero === req.orcamento_escolhido);
      if (!budget || !budget.items || budget.items.length === 0) return;

      const movements: any[] = [];
      const newItems: any[] = [];
      let currentInventoryState = [...inventoryItems]; 

      // Identify supplier name
      const supplierName = budget.fornecedor || 'Fornecedor Externo';

      for (const item of budget.items) {
          const itemNameNormalized = item.description.trim().toLowerCase();
          let invItem = currentInventoryState.find(i => i.condominio_id === req.condominio_id && i.name.trim().toLowerCase() === itemNameNormalized);

          const itemUnitPrice = Number(item.unitPrice) || 0;
          const itemBuyQty = Number(item.quantity) || 0;

          if (invItem) {
              const newQty = Number(invItem.current_qty) + itemBuyQty;
              const status = newQty <= 0 ? 'EMPTY' : newQty <= invItem.min_level ? 'LOW' : 'NORMAL';
              
              // Update local state object
              invItem.current_qty = newQty;
              invItem.status = status;
              invItem.last_updated = new Date().toISOString();
              invItem.last_supplier = supplierName;
              invItem.last_unit_price = itemUnitPrice; // NEW
              invItem.last_buy_qty = itemBuyQty;       // NEW

              await supabase.from('inventory_items').update({ 
                  current_qty: newQty, 
                  last_updated: new Date().toISOString(), 
                  status: status,
                  last_supplier: supplierName,
                  last_unit_price: itemUnitPrice, // Save to DB
                  last_buy_qty: itemBuyQty        // Save to DB
              }).eq('id', invItem.id);
          } else {
              const newItemId = `inv-${Date.now()}-${Math.floor(Math.random()*1000)}`;
              const newItem: InventoryItem = {
                  id: newItemId, 
                  condominio_id: req.condominio_id, 
                  name: item.description, 
                  unit: item.unit || 'un', 
                  min_level: 5, 
                  current_qty: itemBuyQty, 
                  status: 'NORMAL', 
                  category_id: req.category_id || undefined, 
                  last_updated: new Date().toISOString(),
                  last_supplier: supplierName,
                  last_unit_price: itemUnitPrice, // Save to DB
                  last_buy_qty: itemBuyQty        // Save to DB
              };
              newItems.push(newItem);
              currentInventoryState.push(newItem);
              invItem = newItem;
          }
          movements.push({ 
              item_id: invItem.id, 
              condominio_id: req.condominio_id, 
              type: 'IN', 
              qty: itemBuyQty, 
              reason: `Entrada Automática - Pedido ${req.titulo}`, 
              request_id: req.id, 
              created_by_role: UserRole.CONDOMINIO, 
              created_at: new Date().toISOString() 
          });
      }

      if (newItems.length > 0) await supabase.from('inventory_items').insert(newItems);
      if (movements.length > 0) await supabase.from('inventory_movements').insert(movements);

      await updateRequest(req.id, { stock_generated_at: new Date().toISOString() });
      setInventoryItems(currentInventoryState);
      setInventoryMovements(prev => [...movements, ...prev]);
      alert("📦 Estoque atualizado com sucesso!");
  };

  const updateRequestStatus = async (id: string, newStatus: RequestStatus, observacao: string, extraUpdates: Partial<Solicitacao> = {}): Promise<boolean> => {
    const req = requests.find(r => r.id === id);
    if (!req) return false;
    let finalExtraUpdates = { ...extraUpdates };
    const nowIso = new Date().toISOString();
    const log: LogEvento = { id: `h-${Date.now()}`, data: nowIso, usuario_nome: currentUser?.nome || 'Sistema', descricao: observacao, status: newStatus };
    const { delivered_at, ...safeExtraUpdates } = finalExtraUpdates as any;

    const dbPayload = { status: newStatus, historico: [log, ...req.historico], ...safeExtraUpdates };
    const localPayload = { ...dbPayload, delivered_at: newStatus === RequestStatus.CONCLUIDO ? nowIso : req.delivered_at, ...finalExtraUpdates };

    try {
        let { error } = await supabase.from('solicitacoes').update(dbPayload).eq('id', id);
        
        // Retry logic for missing columns
        if (error && (error.message?.includes('column') || error.code === 'PGRST204' || error.code === '42703')) {
             console.warn("Update failed, retrying with fallback payload...", error);
             const fallbackPayload = { ...dbPayload };
             
             // Fields that might be missing in older schema versions
             const potentiallyMissingFields = [
                 'autorizado_por_nome', 
                 'autorizado_por_cargo', 
                 'deadline_days', 
                 'stock_control_enabled', 
                 'estimated_delivery_date', 
                 'due_at',
                 'justificativa_recusa',
                 'justificativa_encerramento'
             ];
             
             potentiallyMissingFields.forEach(col => delete (fallbackPayload as any)[col]);
             
             // Try update again without potential missing columns
             const { error: retryError } = await supabase.from('solicitacoes').update(fallbackPayload).eq('id', id);
             
             if (retryError) {
                 console.error("Fallback update also failed:", retryError);
                 return false;
             }
             error = null; // Mark as success if retry succeeded
        }

        if (error) {
            console.error("Update failed:", error);
            return false;
        }

        // Update local state ONLY after DB success to avoid "infinite loop" UI bug
        setRequests(prev => prev.map(r => r.id === id ? { ...r, ...localPayload } : r));

        if (newStatus === RequestStatus.CONCLUIDO) {
             const updatedReq = { ...req, ...localPayload, stock_control_enabled: (localPayload as any).stock_control_enabled ?? req.stock_control_enabled } as Solicitacao;
             if (updatedReq.stock_control_enabled) await processStockEntry(updatedReq);
        }
        return true;
    } catch (err: any) { 
        console.error("Critical error in updateRequestStatus:", err);
        return false; 
    }
  };

  const deleteRequest = async (id: string) => {
      setRequests(prev => prev.filter(r => r.id !== id));
      await supabase.from('solicitacoes').delete().eq('id', id);
  };

  const getRequestsAll = () => requests;
  const getRequestsByCondo = (condoId: string) => requests.filter(r => r.condominio_id === condoId);

  // --- Users Logic ---
  const addUser = async (u: User) => {
      const { error } = await supabase.from('usuarios').insert(u);
      if (error) {
          alert(`Erro ao salvar: ${error.message}`);
          return false;
      }
      setUsers(prev => [...prev, u]);
      return true;
  };

  const updateUser = async (id: string, data: Partial<User>) => {
      const { error } = await supabase.from('usuarios').update(data).eq('id', id);
      if (error) { 
          console.error("Update User Error:", error);
          alert("Erro ao atualizar usuário: " + error.message); 
          return false; 
      }
      setUsers(prev => prev.map(u => u.id === id ? { ...u, ...data } : u));
      return true;
  };

  const removeUser = async (id: string) => {
      await supabase.from('usuarios').delete().eq('id', id);
      setUsers(prev => prev.filter(u => u.id !== id));
  };
  
  const migrateUser = async (oldId: string, newId: string, data: any) => {
      const newUser = { id: newId, ...data };
      const success = await addUser(newUser);
      if (success) {
          await removeUser(oldId);
          return true;
      }
      return false;
  };

  // --- Suppliers ---
  const addSupplier = async (s: Partial<Supplier>) => {
      const id = `sup-${Date.now()}`;
      const newSup = { id, active: true, ...s } as Supplier;
      setSuppliers(prev => [...prev, newSup]);
      await supabase.from('suppliers').insert(newSup);
      return id;
  };

  const updateSupplier = async (id: string, data: Partial<Supplier>) => {
      setSuppliers(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
      await supabase.from('suppliers').update(data).eq('id', id);
  };

  const toggleSupplierStatus = async (id: string) => {
      const s = suppliers.find(s => s.id === id);
      if (s) updateSupplier(id, { active: !s.active });
  };

  // --- Inventory Logic ---
  const registerConsumption = async (itemId: string, qty: number, reason: string) => {
      const item = inventoryItems.find(i => i.id === itemId);
      if (!item) return false;
      if (item.current_qty < qty) { alert("Quantidade insuficiente."); return false; }
      
      const newQty = Number(item.current_qty) - Number(qty);
      const status = newQty <= 0 ? 'EMPTY' : newQty <= item.min_level ? 'LOW' : 'NORMAL';

      setInventoryItems(prev => prev.map(i => i.id === itemId ? { ...i, current_qty: newQty, status } : i));

      await supabase.from('inventory_items').update({ current_qty: newQty, status }).eq('id', itemId);
      await supabase.from('inventory_movements').insert({ item_id: itemId, condominio_id: item.condominio_id, type: 'OUT', qty, reason, created_by_role: currentUser?.role || UserRole.CONDOMINIO, created_at: new Date().toISOString() });
      return true;
  };

  const adjustStockQuantity = async (itemId: string, newQty: number, reason: string) => {
      const item = inventoryItems.find(i => i.id === itemId);
      if (!item) return false;
      const diff = newQty - item.current_qty;
      const status = newQty <= 0 ? 'EMPTY' : newQty <= item.min_level ? 'LOW' : 'NORMAL';

      setInventoryItems(prev => prev.map(i => i.id === itemId ? { ...i, current_qty: newQty, status } : i));
      
      await supabase.from('inventory_items').update({ current_qty: newQty, status }).eq('id', itemId);
      await supabase.from('inventory_movements').insert({ item_id: itemId, condominio_id: item.condominio_id, type: 'ADJUST', qty: Math.abs(diff), reason: `${reason} (Ajuste de ${item.current_qty} para ${newQty})`, created_by_role: currentUser?.role || UserRole.ADMIN, created_at: new Date().toISOString() });
      return true;
  };

  const updateInventoryItem = async (id: string, data: Partial<InventoryItem>) => {
      // Logic to determine status based on new levels or quantity
      const targetItem = inventoryItems.find(i => i.id === id);
      if (!targetItem) return false;

      const merged = { ...targetItem, ...data };
      let newStatus: any = 'NORMAL';
      
      if (merged.current_qty <= 0) newStatus = 'EMPTY';
      else if (merged.current_qty <= merged.min_level) newStatus = 'LOW';
      else if (merged.max_level && merged.current_qty > merged.max_level) newStatus = 'OVERSTOCK';
      else newStatus = 'NORMAL';

      const finalData = { ...data, status: newStatus, last_updated: new Date().toISOString() };
      
      setInventoryItems(prev => prev.map(i => i.id === id ? { ...i, ...finalData } : i));
      
      const { error } = await supabase.from('inventory_items').update(finalData).eq('id', id);
      if (error) {
          console.error("Failed to update inventory item:", error);
          alert("Erro ao atualizar item. Verifique se o banco de dados possui as colunas novas (ideal_level, max_level).");
          return false;
      }
      return true;
  };

  const deleteInventoryItem = async (id: string) => {
      // 1. Optimistic Update (Remove from UI immediately)
      const previousItems = [...inventoryItems];
      setInventoryItems(prev => prev.filter(i => i.id !== id));

      // 2. Database Delete
      const { error } = await supabase.from('inventory_items').delete().eq('id', id);
      
      // 3. Rollback if Error
      if (error) {
          console.error("Error deleting item:", error);
          alert("Erro ao excluir item. Provavelmente existem registros históricos vinculados a ele. Execute o script de atualização do banco (update_inventory_schema.sql) para corrigir.");
          setInventoryItems(previousItems); // Rollback
      }
  };

  // --- Categories ---
  const addCategory = async (c: PurchaseCategory) => {
      const newC = { ...c, id: `cat-${Date.now()}` };
      setCategories(prev => [...prev, newC]);
      await supabase.from('categories').insert(newC);
  };
  
  const updateCategory = async (id: string, c: Partial<PurchaseCategory>) => {
      setCategories(prev => prev.map(cat => cat.id === id ? { ...cat, ...c } : cat));
      await supabase.from('categories').update(c).eq('id', id);
  };
  
  const deleteCategory = async (id: string) => {
      setCategories(prev => prev.filter(c => c.id !== id));
      await supabase.from('categories').delete().eq('id', id);
  };

  // --- Contacts ---
  const addContact = async (c: Partial<CondoContact>) => {
      const newC = { ...c, id: `ct-${Date.now()}` } as CondoContact;
      setCondoContacts(prev => [...prev, newC]);
      await supabase.from('contacts').insert(newC);
  };
  
  const updateContact = async (id: string, c: Partial<CondoContact>) => {
      setCondoContacts(prev => prev.map(con => con.id === id ? { ...con, ...c } : con));
      await supabase.from('contacts').update(c).eq('id', id);
  };
  
  const deleteContact = async (id: string) => {
      setCondoContacts(prev => prev.filter(c => c.id !== id));
      await supabase.from('contacts').delete().eq('id', id);
  };

  // --- Budgets ---
  const saveBudget = async (reqId: string, budget: Orcamento) => {
      const req = requests.find(r => r.id === reqId);
      if (!req) return;
      let finalBudget = { ...budget };
      if (finalBudget.numero === 0) {
          const maxNum = req.orcamentos.reduce((max, b) => Math.max(max, b.numero), 0);
          finalBudget.numero = maxNum + 1;
      }
      const newBudgets = req.orcamentos.some(o => o.id === finalBudget.id) ? req.orcamentos.map(o => o.id === finalBudget.id ? finalBudget : o) : [...req.orcamentos, finalBudget];
      await updateRequest(reqId, { orcamentos: newBudgets });
  };
  
  const deleteBudget = async (reqId: string, budgetId: string) => {
      const req = requests.find(r => r.id === reqId);
      if (!req) return;
      const newBudgets = req.orcamentos.filter(o => o.id !== budgetId);
      await updateRequest(reqId, { orcamentos: newBudgets });
  };

  // --- Misc ---
  const updateLogo = async (file: File) => {
      const reader = new FileReader();
      reader.onload = async () => {
          const url = reader.result as string;
          setLogoUrl(url);
          await supabase.from('app_settings').upsert({ id: 'global', logo_url: url });
      };
      reader.readAsDataURL(file);
  };

  const fetchLastPurchase = async () => null;
  const recordPurchaseMemory = async () => {};
  const triggerManualNotification = async (reqId: string) => {
      const req = requests.find(r => r.id === reqId);
      if(req) await sendManualNotification(req, condoContacts);
  };
  
  const sendMessage = async (reqId: string, text: string) => {
      if (!currentUser || !text.trim()) return;
      
      const tempId = `temp-${Date.now()}`;
      const newMessage = {
          request_id: reqId,
          content: text,
          sender_id: currentUser.id,
          sender_role: currentUser.role,
          created_at: new Date().toISOString()
      };

      // Optimistic Update
      setRequests(prev => prev.map(r => {
          if (r.id === reqId) {
              return { ...r, messages: [...(r.messages || []), { ...newMessage, id: tempId }] };
          }
          return r;
      }));

      try {
          // Try inserting into 'messages' table first
          const { data, error } = await supabase.from('messages').insert(newMessage).select().single();
          
          if (error) throw error; // Throw to catch block to trigger fallback

          // Success with table
          setRequests(prev => prev.map(r => {
              if (r.id === reqId) {
                  return { 
                      ...r, 
                      messages: r.messages?.map(m => m.id === tempId ? { ...data } : m) 
                  };
              }
              return r;
           }));

      } catch (err: any) {
          console.warn("Primary message send failed, attempting fallback...", err);
          
          // Fallback: Update JSONB column in solicitacoes
          try {
              const req = requests.find(r => r.id === reqId);
              if (req) {
                  // Filter out temp messages to avoid duplication in DB
                  const currentJsonbMsgs = Array.isArray(req.messages) ? req.messages.filter(m => !m.id.toString().startsWith('temp-')) : [];
                  // Add new message with a generated ID (using date/random to ensure uniqueness)
                  const fallbackId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                  const msgForJsonb = { ...newMessage, id: fallbackId };
                  
                  const updatedJsonbMsgs = [...currentJsonbMsgs, msgForJsonb];
                  
                  const { error: jsonbError } = await supabase.from('solicitacoes')
                      .update({ messages: updatedJsonbMsgs })
                      .eq('id', reqId);
                      
                  if (jsonbError) throw jsonbError;

                  // Success with JSONB
                  setRequests(prev => prev.map(r => {
                      if (r.id === reqId) {
                          return { 
                              ...r, 
                              messages: r.messages?.map(m => m.id === tempId ? msgForJsonb : m) 
                          };
                      }
                      return r;
                  }));
              }
          } catch (finalErr: any) {
              console.error("All message send attempts failed:", finalErr);
              alert(`Erro ao enviar mensagem: ${finalErr.message || 'Falha de conexão'}`);
              
              // Rollback optimistic update
              setRequests(prev => prev.map(r => {
                  if (r.id === reqId) {
                      return { ...r, messages: r.messages?.filter(m => m.id !== tempId) };
                  }
                  return r;
              }));
          }
      }
  };

  const markMessagesAsRead = async (reqId: string) => {
      if (!currentUser) return;
      
      // Update local state
      setRequests(prev => prev.map(r => {
          if (r.id === reqId && r.messages) {
              return {
                  ...r,
                  messages: r.messages.map(m => {
                      if (!m.read_at && m.sender_id !== currentUser.id) {
                          return { ...m, read_at: new Date().toISOString() };
                      }
                      return m;
                  })
              };
          }
          return r;
      }));

      // Update DB - mark all unread messages from OTHER users as read
      await supabase.from('messages')
          .update({ read_at: new Date().toISOString() })
          .eq('request_id', reqId)
          .is('read_at', null)
          .neq('sender_id', currentUser.id);
  };

  return (
    <AppContext.Provider value={{
      currentUser, users, requests, suppliers, inventoryItems, inventoryMovements,
      purchaseHistory, categories, condoContacts, loading, isOnline, logoUrl, selectedCondoId,
      setSelectedCondoId, login, logout, refreshData, addRequest, createStockReplenishmentRequest, updateRequest,
      updateRequestStatus, deleteRequest, getRequestsAll, getRequestsByCondo,
      addUser, updateUser, removeUser, migrateUser, addSupplier, updateSupplier,
      toggleSupplierStatus, registerConsumption, adjustStockQuantity, updateInventoryItem, deleteInventoryItem,
      addCategory, updateCategory, deleteCategory, addContact, updateContact, deleteContact,
      saveBudget, deleteBudget, updateLogo,
      fetchLastPurchase, recordPurchaseMemory, triggerManualNotification, sendMessage, markMessagesAsRead
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};
