import { useNavigate } from "react-router-dom";
import { StudentDrilldownCard } from "./StudentDrilldownCard";

export const StudentNotificationPanel = ({ notifications, onNavigateAway }) => {
  const navigate = useNavigate();

  if (!notifications.length) {
    return (
      <div className="student-notification-panel">
        <p className="student-empty-state">No updates yet.</p>
      </div>
    );
  }

  return (
    <div className="student-notification-panel">
      {notifications.map((item) => (
        <StudentDrilldownCard
          key={item.id}
          className={`student-notification-row ${item.isUnread ? "is-unread" : ""}`}
          title={item.title}
          subtitle={item.subtitle}
          onClick={() => {
            navigate(`/chapters/${item.chapterNumber}/sections/${item.sourceSectionId}`);
            onNavigateAway?.();
          }}
        />
      ))}
    </div>
  );
};
