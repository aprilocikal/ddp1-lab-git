import { getCourseContents } from '@/lib/moodle';
import { getUser } from '@/lib/storage';

// Icon map by module type
const modIcons = {
  assign: '📝',
  quiz: '📊',
  resource: '📄',
  url: '🔗',
  forum: '💬',
  page: '📃',
  folder: '📁',
  label: null,
  choice: '🗳️',
  feedback: '📋',
  workshop: '🛠️',
};

export async function GET(request, { params }) {
  try {
    const p = await params;
    const { courseId } = p;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return Response.json({ error: 'userId diperlukan' }, { status: 400 });
    }

    const user = await getUser(userId);
    if (!user) {
      return Response.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }

    const sections = await getCourseContents(user.token, courseId);

    // Clean up sections: remove empty labels, add icon info
    const cleaned = sections
      .filter(s => s.modules && s.modules.length > 0)
      .map(section => ({
        id: section.id,
        name: section.name,
        summary: section.summary || '',
        modules: section.modules
          .filter(mod => mod.modname !== 'label' || mod.description)
          .map(mod => ({
            id: mod.id,
            name: mod.name,
            modname: mod.modname,
            modplural: mod.modplural,
            url: mod.url || null,
            description: mod.description || null,
            dates: mod.dates || [],
            completiondata: mod.completiondata || null,
            contents: (mod.contents || []).filter(c => c.type === 'file').map(c => ({
              filename: c.filename,
              fileurl: c.fileurl,
              filesize: c.filesize,
            })),
          })),
      }));

    return Response.json({ success: true, sections: cleaned });
  } catch (error) {
    console.error('Course contents error:', error.message);
    return Response.json({ error: 'Gagal mengambil konten mata kuliah' }, { status: 500 });
  }
}
