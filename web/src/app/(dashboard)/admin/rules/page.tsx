"use client";
import { useEffect, useState } from "react";
import { fetchAPI } from "@/lib/api";
import styles from "../../players/players.module.css"; 

export default function RulesPage() {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAPI("/rules/season/1") 
      .then(res => setRules(res))
      .catch(err => {
         console.error(err);
         setRules([]);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Carregando regras de pontuação...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Configuração de Regras (Admin) ⚙️</h1>
        <button className={styles.primaryBtn} onClick={() => alert("Criar regra (Em breve)")}>
          Nova Regra
        </button>
      </div>

      <div className={styles.list}>
        {rules.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Nenhuma regra configurada ainda.</p>}
        {rules.map(r => (
           <div key={r.id_event_score_rule} className={styles.listItem}>
             <div className={styles.details} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
               <div>
                  <strong>{r.event_type} no contexto {r.context}</strong>
               </div>
               <span className={styles.guest} style={{ fontSize: '14px', padding: '6px 12px' }}>
                 {r.points} Pontos
               </span>
             </div>
             <div className={styles.actionsBox}>
               <button className={styles.secondaryBtn} onClick={() => alert("Editar")}>Editar</button>
             </div>
           </div>
        ))}
      </div>
    </div>
  );
}
