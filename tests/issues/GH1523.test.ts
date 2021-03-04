import { Collection, Entity, Enum, ManyToOne, MikroORM, OneToMany, PrimaryKey, Property, wrap } from '@mikro-orm/core';
import { SqliteDriver } from '@mikro-orm/sqlite';

abstract class Base {

  @PrimaryKey()
  id!: number;

}

@Entity()
class Param extends Base {

  @ManyToOne({ nullable: true })
  public child?: Child;

}

@Entity()
class Child extends Base {

  @ManyToOne({ nullable: true })
  public parent?: Parent;

  @OneToMany(() => Param, entity => entity.child)
  public params: Collection<Param> = new Collection<Param>(this);

}

@Entity()
class Parent extends Base {

  @OneToMany(() => Child, entity => entity.parent)
  public children: Collection<Child> = new Collection<Child>(this);

}

describe('GH issue 997', () => {

  let orm: MikroORM<SqliteDriver>;

  beforeAll(async () => {
    orm = await MikroORM.init({
      entities: [
        Base,
        Parent,
        Child,
        Param,
      ],
      dbName: ':memory:',
      type: 'sqlite',
    });
    await orm.getSchemaGenerator().ensureDatabase();
    await orm.getSchemaGenerator().dropSchema();
    await orm.getSchemaGenerator().createSchema();
  });

  afterAll(async () => {
    await orm.close(true);
  });

  test(`GH issue 1523`, async () => {
    const paramsArray = [];
    const parent = new Parent();
    const ch1 = new Child();
    const ch2 = new Child();
    const pa1 = new Param();

    ch1.params.add(pa1);
    parent.children.add(ch1, ch2);

    for (let i = 0; i < 10; i++) {
      paramsArray.push(new Param());
    }

    orm.em.persist(parent);
    orm.em.persist(paramsArray);
    await orm.em.flush();
    orm.em.clear();

    const fetchedParent = await orm.em.findOneOrFail(Parent, { id: { $ne: null } }, ['children.params']);
    const fetchedParams = await orm.em.createQueryBuilder(Param, 'param').where({ child: null }).getResult();
    const [child1, child2] = fetchedParent.children.getItems();
    const [param1, param2] = fetchedParams;

    child2.params.add(param1, param2);

    // bug "works" only if we fetch something from same table, but with other id
    const fetchedParamsAgain = await orm.em.createQueryBuilder(Param, 'param').where({ child: true }).getResult();

    expect(wrap(param1, true).__originalEntityData!.child).toBeUndefined();
  });

});
