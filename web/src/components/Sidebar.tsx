"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import styles from "./Sidebar.module.css";

const MENU_ITEMS = [
  { name: "Dashboard", path: "/" },
  { name: "Temporadas", path: "/seasons" },
  { name: "Times", path: "/teams" },
  { name: "Jogadores", path: "/players" },
  { name: "Partidas", path: "/matches" },
  { name: "Prêmios (Awards)", path: "/awards" },
  { name: "Regras (Admin)", path: "/admin/rules" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <h2>Baygon <span>API</span></h2>
      </div>

      <nav className={styles.nav}>
        {MENU_ITEMS.map((item) => {
          const isActive = pathname === item.path || (item.path !== "/" && pathname.startsWith(item.path));
          return (
            <Link 
              key={item.path} 
              href={item.path} 
              className={`${styles.navItem} ${isActive ? styles.active : ""}`}
            >
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className={styles.footer}>
        <div className={styles.userInfo}>
          <div className={styles.avatar}>{user?.username?.charAt(0).toUpperCase() || "U"}</div>
          <div className={styles.details}>
            <span className={styles.name}>{user?.username || "Usuário"}</span>
            <span className={styles.role}>{user?.role || "Admin"}</span>
          </div>
        </div>
        <button onClick={logout} className={styles.logoutBtn}>
          Sair
        </button>
      </div>
    </aside>
  );
}
