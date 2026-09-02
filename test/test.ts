import * as readline from 'readline';
import { ObjectId } from 'mongodb';
import { DbContext, Model, MongoEFCollection } from '../src';
import { CollectionName } from '../src/decorators/CollectionName';
import { Column } from '../src/decorators/Column';
import { ForeignKey } from '../src/decorators/ForeignKey';
import { Index } from '../src/decorators/MongoIndex';
import { JsonIgnore } from '../src/decorators/JsonIgnore';
import { NotMapped } from '../src/decorators/NotMapped';
import { SoftDelete } from '../src/decorators/SoftDelete';

// ─── Modelos de prueba ────────────────────────────────────────────────────────

@CollectionName('test_users')
@Index({ email: 1 }, { unique: false })
class TestUser extends Model {
    name: string = '';
    email: string = '';

    @JsonIgnore
    passwordHash: string = '';

    @Column('first_name')
    firstName: string = '';

    @NotMapped
    sessionToken: string = 'token-en-memoria';
}

@CollectionName('test_posts')
@SoftDelete
class TestPost extends Model {
    title: string = '';
    userId: ObjectId = new ObjectId();

    @ForeignKey(() => TestUser, 'userId')
    user?: TestUser;
}

class TestContext extends DbContext {
    users: MongoEFCollection<TestUser> = new MongoEFCollection(TestUser);
    posts: MongoEFCollection<TestPost> = new MongoEFCollection(TestPost);
}

// ─── Runner ───────────────────────────────────────────────────────────────────

async function askUrl(): Promise<string> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => {
        rl.question('URL de MongoDB (Enter = mongodb://localhost:27017): ', answer => {
            rl.close();
            resolve(answer.trim() || 'mongodb://localhost:27017');
        });
    });
}

async function runTests(url: string): Promise<void> {
    console.log(`\nConectando a ${url}...`);
    const context = new TestContext(url, 'mongoef_test', false);
    await context.connect();
    console.log('Conectado.\n');

    await context.connection.collection('test_users').deleteMany({});
    await context.connection.collection('test_posts').deleteMany({});

    let passed = 0;
    let failed = 0;

    async function test(name: string, fn: () => Promise<void>): Promise<void> {
        try {
            await fn();
            console.log(`  ✅ ${name}`);
            passed++;
        } catch (err: any) {
            console.log(`  ❌ ${name}: ${err?.message ?? err}`);
            failed++;
        }
    }

    function assert(condition: boolean, msg: string): void {
        if (!condition) throw new Error(msg);
    }

    // ── Insert y save ─────────────────────────────────────────────────────────

    console.log('📦 Insert / Save');

    let userId: ObjectId;

    await test('insert asigna _id', async () => {
        const user = new TestUser();
        user.name = 'Jorge';
        user.email = 'jorge@test.com';
        user.passwordHash = 'hash-secreto';
        user.firstName = 'Jorge';
        user.sessionToken = 'token-123';
        await user.save(context);
        assert(user._id !== undefined, 'El _id debe asignarse tras el insert');
        userId = user._id!;
    });

    await test('update modifica el documento existente', async () => {
        const user = await context.users.get(userId, true);
        user!.name = 'Jorge Updated';
        await user!.save(context);
        const updated = await context.users.get(userId, true);
        assert(updated!.name === 'Jorge Updated', 'El nombre debe haberse actualizado');
    });

    // ── @Column ───────────────────────────────────────────────────────────────

    console.log('\n🔤 @Column');

    await test('@Column guarda con el nombre de campo correcto en MongoDB', async () => {
        const raw = await context.connection.collection('test_users').findOne({ _id: userId });
        assert(raw?.first_name === 'Jorge', `Se esperaba first_name="Jorge", se obtuvo: ${raw?.first_name}`);
    });

    await test('@Column recupera el valor al leer', async () => {
        const user = await context.users.get(userId, true);
        assert(user!.firstName === 'Jorge', `Se esperaba firstName="Jorge", se obtuvo: ${user!.firstName}`);
    });

    // ── @NotMapped ────────────────────────────────────────────────────────────

    console.log('\n🚫 @NotMapped');

    await test('@NotMapped no persiste el campo en MongoDB', async () => {
        const raw = await context.connection.collection('test_users').findOne({ _id: userId });
        assert(!('sessionToken' in (raw ?? {})), 'sessionToken no debe existir en MongoDB');
    });

    await test('@NotMapped mantiene el valor por defecto en el modelo', async () => {
        const user = await context.users.get(userId, true);
        assert(user!.sessionToken === 'token-en-memoria', 'El valor por defecto debe mantenerse');
    });

    // ── @JsonIgnore ───────────────────────────────────────────────────────────

    console.log('\n👁️ @JsonIgnore');

    await test('@JsonIgnore excluye el campo del JSON pero lo persiste en MongoDB', async () => {
        const user = await context.users.get(userId, true);
        const json = JSON.parse(JSON.stringify(user));
        assert(!('passwordHash' in json), 'passwordHash no debe aparecer en JSON');
        const raw = await context.connection.collection('test_users').findOne({ _id: userId });
        assert(raw?.passwordHash === 'hash-secreto', 'passwordHash sí debe existir en MongoDB');
    });

    // ── all / filter ──────────────────────────────────────────────────────────

    console.log('\n🔍 all / filter');

    await test('all retorna todos los documentos', async () => {
        const all = await context.users.all();
        assert(all.length >= 1, 'Debe haber al menos un usuario');
    });

    await test('filter con filtro exacto retorna los correctos', async () => {
        const results = await context.users.filter({ name: 'Jorge Updated' });
        assert(results.length === 1, 'Debe encontrar exactamente 1 usuario');
        assert(results[0].name === 'Jorge Updated', 'El nombre debe coincidir');
    });

    // ── get / getOrNew ────────────────────────────────────────────────────────

    console.log('\n🔑 get / getOrNew');

    await test('get por ObjectId retorna el documento', async () => {
        const user = await context.users.get(userId);
        assert(user !== null, 'Debe encontrar el usuario');
    });

    await test('get por string id retorna el documento', async () => {
        const user = await context.users.get(userId.toHexString());
        assert(user !== null, 'Debe encontrar el usuario por string');
    });

    await test('get con id inexistente retorna null', async () => {
        const user = await context.users.get(new ObjectId());
        assert(user === null, 'Debe retornar null');
    });

    await test('get con throwIfNotExists lanza error', async () => {
        let threw = false;
        try {
            await context.users.get(new ObjectId(), true);
        } catch {
            threw = true;
        }
        assert(threw, 'Debe lanzar un error');
    });

    await test('getOrNew crea instancia nueva si no existe', async () => {
        const user = await context.users.getOrNew(new ObjectId());
        assert(user._id === undefined, 'La nueva instancia no debe tener _id');
    });

    // ── QueryBuilder ──────────────────────────────────────────────────────────

    console.log('\n⚙️  QueryBuilder');

    let extraUserId: ObjectId;

    await test('insert segundo usuario para paginación', async () => {
        const user2 = new TestUser();
        user2.name = 'Ana';
        user2.email = 'ana@test.com';
        user2.passwordHash = 'hash2';
        await user2.save(context);
        extraUserId = user2._id!;
        assert(!!extraUserId, 'El segundo usuario debe tener _id');
    });

    await test('.query().where().toList() filtra correctamente', async () => {
        const results = await context.users.query({ name: 'Ana' }).toList();
        assert(results.length === 1, 'Debe encontrar 1 usuario con nombre Ana');
    });

    await test('.query().orderBy().toList() ordena correctamente', async () => {
        const results = await context.users.query().orderBy('name', 'asc').toList();
        assert(results[0].name <= results[1].name, 'Debe estar ordenado ascendente');
    });

    await test('.query().skip(1).take(1).toList() pagina correctamente', async () => {
        const results = await context.users.query().orderBy('name').skip(1).take(1).toList();
        assert(results.length === 1, 'Debe retornar exactamente 1 resultado');
    });

    await test('.query().first() retorna el primer resultado', async () => {
        const user = await context.users.query({ name: 'Ana' }).first();
        assert(user !== null && user.name === 'Ana', 'Debe retornar a Ana');
    });

    await test('.query().count() retorna la cantidad correcta', async () => {
        const total = await context.users.query().count();
        assert(total === 2, `Se esperaban 2 usuarios, se obtuvo: ${total}`);
    });

    // ── @ForeignKey / include ─────────────────────────────────────────────────

    console.log('\n🔗 @ForeignKey / include');

    let postId: ObjectId;

    await test('insert de post con userId', async () => {
        const post = new TestPost();
        post.title = 'Post de Jorge';
        post.userId = userId;
        await post.save(context);
        postId = post._id!;
        assert(!!postId, 'El post debe tener _id');
    });

    await test('.query().include() hidrata la relación con $lookup', async () => {
        const posts = await context.posts.query().include('user').toList();
        assert(posts.length === 1, 'Debe haber 1 post');
        assert(posts[0].user !== undefined, 'El campo user debe estar hidratado');
        assert(posts[0].user!.name === 'Jorge Updated', `Se esperaba "Jorge Updated", se obtuvo: "${posts[0].user!.name}"`);
    });

    await test('include respeta @Column en el modelo relacionado', async () => {
        const posts = await context.posts.query().include('user').toList();
        assert(posts[0].user!.firstName === 'Jorge', 'El firstName debe mapearse correctamente desde first_name');
    });

    // ── @SoftDelete ───────────────────────────────────────────────────────────

    console.log('\n🗑️  @SoftDelete');

    await test('.delete() en modelo con @SoftDelete setea deletedAt', async () => {
        const post = await context.posts.get(postId, true);
        await context.posts.delete(post!);
        const raw = await context.connection.collection('test_posts').findOne({ _id: postId });
        assert(raw?.deletedAt !== null && raw?.deletedAt !== undefined, 'deletedAt debe estar seteado');
    });

    await test('all() excluye documentos soft-deleted', async () => {
        const posts = await context.posts.all();
        assert(posts.length === 0, 'No deben aparecer posts eliminados en all()');
    });

    await test('.query().withDeleted() incluye soft-deleted', async () => {
        const posts = await context.posts.query().withDeleted().toList();
        assert(posts.length === 1, 'Con withDeleted() debe aparecer el post eliminado');
    });

    // ── delete array con deleteMany ────────────────────────────────────────────

    console.log('\n🗑️  delete (array → deleteMany)');

    await test('delete con array usa deleteMany', async () => {
        const users = await context.users.all();
        const borrados = await context.users.delete(users);
        assert(borrados === 2, `Se esperaban 2 borrados, se obtuvieron: ${borrados}`);
        const restantes = await context.users.all();
        assert(restantes.length === 0, 'No deben quedar usuarios');
    });

    // ── @Index ────────────────────────────────────────────────────────────────

    console.log('\n📑 @Index');

    await test('@Index crea el índice al conectar', async () => {
        const indexes = await context.connection.collection('test_users').indexes();
        const hasIndex = indexes.some(idx => idx.key && 'email' in idx.key);
        assert(hasIndex, 'Debe existir un índice sobre email');
    });

    // ─────────────────────────────────────────────────────────────────────────

    console.log(`\n${'─'.repeat(40)}`);
    console.log(`Total: ${passed + failed} | ✅ ${passed} pasaron | ❌ ${failed} fallaron`);

    await context.connection.collection('test_users').deleteMany({});
    await context.connection.collection('test_posts').deleteMany({});
    console.log('\nColecciones de prueba limpiadas.\n');

    process.exit(failed > 0 ? 1 : 0);
}

async function main(): Promise<void> {
    const url = process.env['MONGO_URL'] ?? await askUrl();
    await runTests(url);
}

main().catch(err => {
    console.error('Error fatal:', err);
    process.exit(1);
});
