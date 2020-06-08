import { Collection, EntitySchema, MikroORM } from '../../lib';
import { PostgreSqlDriver } from '../../lib/drivers/PostgreSqlDriver';
import { v4 } from 'uuid';

class BaseProps {

  id: string = v4();

}

class TaskProps extends BaseProps {

  version: Date = new Date();
  projects: Collection<ProjectProps> = new Collection<ProjectProps>(this);

}

class ProjectProps extends BaseProps {

  name!: string;
  tasks: Collection<TaskProps> = new Collection<TaskProps>(this);

}

const BaseSchema = new EntitySchema<BaseProps>({
  class: BaseProps,
  abstract: true,
  properties: {
    id: {
      columnType: 'varchar(36)',
      type: 'string',
      primary: true,
      unique: true,
    },
  },
});

const TaskSchema = new EntitySchema<TaskProps, BaseProps>({
  class: TaskProps,
  extends: 'BaseProps',
  tableName: '603_task',
  properties: {
    id: {
      columnType: 'varchar(36)',
      type: 'string',
      primary: true,
      unique: false,
    } as any,
    version: {
      columnType: 'datetime(6)',
      type: 'Date',
      primary: true,
      default: 'CURRENT_TIMESTAMP(6)',
    },
    projects: {
      entity: () => ProjectProps,
      reference: 'm:n',
      inversedBy: 'tasks',
      onDelete: 'cascade',
      onUpdateIntegrity: 'cascade',
    },
  },
});

const ProjectSchema = new EntitySchema<ProjectProps, BaseProps>({
  class: ProjectProps,
  extends: 'BaseProps',
  tableName: '603_project',
  properties: {
    name: {
      type: 'string',
      columnType: 'varchar(255)',
      nullable: false,
    },
    tasks: {
      entity: () => TaskProps,
      mappedBy: 'projects',
      reference: 'm:n',
      onDelete: 'cascade',
      onUpdateIntegrity: 'cascade',
    },
  },
});

describe('GH issue 560', () => {

  let orm: MikroORM<PostgreSqlDriver>;
  let projectId: string;
  let taskId: string;

  beforeAll(async () => {
    orm = await MikroORM.init({
      entities: [BaseSchema, TaskSchema, ProjectSchema],
      dbName: `mikro_orm_test_gh_603`,
      type: 'mysql',
      port: 3307,
      cache: { enabled: false },
    });
    await orm.getSchemaGenerator().ensureDatabase();
    await orm.getSchemaGenerator().dropSchema();
    await orm.getSchemaGenerator().createSchema();

    const project = orm.em.create(ProjectProps, {name: 'Test project'});
    const task = orm.em.create(TaskProps, {});
    await orm.em.persistAndFlush([project, task]);
    projectId = project.id;
    taskId = task.id;
    orm.em.clear();
  });

  afterAll(async () => {
    await orm.close(true);
  });

  test(`GH issue 603, create entity`, async () => {
    const project = await orm.em.findOne(ProjectProps, {id: projectId}) as ProjectProps;
    const task = orm.em.create(TaskProps, {});
    orm.em.persist(task);
    task.projects.add(project);
    await expect(orm.em.flush()).resolves.not.toThrow();
    orm.em.clear();
  });

  // here is example, where history table implemented inside actual table with data, using
  // composite pk for versioning purposes. Id stays the same, but version can be changed
  test(`GH issue 603, update entity`, async () => {
    const project = await orm.em.findOne(ProjectProps, {id: projectId}) as ProjectProps;
    const task = await orm.em.findOne(TaskProps, {id: taskId}) as TaskProps;
    const newVersion = orm.em.create(TaskProps, {id: task.id});
    newVersion.projects.add(project);
    await expect(orm.em.flush()).resolves.not.toThrow();
    orm.em.clear();
  });
});
