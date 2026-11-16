'use client';

import { useRouter } from 'next/navigation';

export default function CourseCard({ course }) {
  const router = useRouter();

  // Array of vibrant colors for the left border
  const colors = [
    '#3b82f6', // blue
    '#8b5cf6', // purple
    '#06b6d4', // cyan
    '#10b981', // emerald
    '#f59e0b', // amber
    '#f43f5e', // rose
    '#f97316', // orange
  ];
  
  // Consistent color based on course ID
  const colorIndex = Math.abs(course.id || 0) % colors.length;
  const borderColor = colors[colorIndex];

  return (
    <div 
      className="course-card stagger-item"
      onClick={() => router.push(`/course/${course.id}?name=${encodeURIComponent(course.fullname)}`)}
      style={{ 
        cursor: 'pointer',
        borderLeft: `4px solid ${borderColor}`
      }}
    >
      <div className="course-header">
        <div>
          <div className="course-name">{course.fullname}</div>
          <div className="course-shortname">{course.shortname}</div>
        </div>
      </div>
    </div>
  );
}
