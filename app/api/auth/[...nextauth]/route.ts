import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Usuario', type: 'text' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (
          credentials?.username === process.env.ADMIN_USER &&
          credentials?.password === process.env.ADMIN_PASSWORD
        ) {
          return { id: '1', name: process.env.ADMIN_USER };
        }
        return null;
      },
    }),
  ],
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
