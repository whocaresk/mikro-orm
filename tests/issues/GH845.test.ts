import { Entity, MikroORM, PrimaryKey, Property, OneToMany, ManyToOne, Collection } from '@mikro-orm/core';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';

abstract class Base {

  @PrimaryKey()
  public id!: number;

}

@Entity()
class Relation1 extends Base {

  @ManyToOne()
  public parent!: Parent;

}

@Entity({
  discriminatorColumn: 'type',
  discriminatorMap: {
    Child1: 'Child1',
    Child2: 'Child2',
  },
})
class Parent extends Base {

  @Property()
  public type!: string;

  @OneToMany(() => Relation1, e => e.parent)
  public qaInfo: Collection<Relation1> = new Collection<Relation1>(this);

}

@Entity()
class Child1Specific extends Base {

  @ManyToOne()
  public child1!: Child1;

}

@Entity()
class Child1 extends Parent {

  @OneToMany(() => Child1Specific, e => e.child1)
  public rel: Collection<Child1Specific> = new Collection<Child1Specific>(this);

}

@Entity()
class Child2 extends Parent {}

describe('GH issue 845', () => {

  let orm: MikroORM<PostgreSqlDriver>;

  beforeAll(async () => {
    orm = await MikroORM.init({
      metadataProvider: TsMorphMetadataProvider, // will break with ReflectMetadataProvider as well, but in different way
      entities: [Base, Relation1, Child1Specific, Parent, Child1, Child2],
      dbName: `mikro_orm_test_gh_845`,
      type: 'postgresql',
      cache: { enabled: false },
    });
    await orm.getSchemaGenerator().ensureDatabase();
    await orm.getSchemaGenerator().dropSchema();
    await orm.getSchemaGenerator().createSchema();
  });

  afterAll(async () => {
    await orm.close(true);
  });

  test(`GH issue 845`, async () => {
    expect(true).toBe(true);
  });
});
