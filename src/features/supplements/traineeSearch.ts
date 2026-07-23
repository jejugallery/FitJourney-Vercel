import type { CourseTrainee } from './types.js';

export function filterCourseTrainees(trainees: CourseTrainee[], search: string): CourseTrainee[] {
  const query = search.trim().toLocaleLowerCase('th-TH');
  if (!query) return trainees;
  return trainees.filter(trainee => trainee.nickname.toLocaleLowerCase('th-TH').includes(query));
}
