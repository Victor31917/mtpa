import { NavLink } from "react-router-dom";

import useAuth from "../../hooks/useAuth";
import {
  getNavigationForUser,
} from "../../utils/permissions";

import "./Sidebar.css";

const Sidebar = () => {
  const { usuario } = useAuth();

  const items =
    getNavigationForUser(usuario);

  return (
    <aside
      className="app-sidebar"
      aria-label="Navegación principal"
    >
      <div className="app-sidebar__brand">
        <strong>M.T.P.A.</strong>

        <span>
          Mejora Técnica de Producción Avícola
        </span>
      </div>

      <nav className="app-sidebar__nav">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `app-sidebar__link${
                isActive
                  ? " app-sidebar__link--active"
                  : ""
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;